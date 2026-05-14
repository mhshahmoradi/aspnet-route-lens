import * as vscode from "vscode";
import { RouteIndexer } from "./route-indexer";
import { RouteSymbolProvider } from "./symbol-provider";
import { RouteTreeProvider } from "./route-tree-provider";
import { ParsedRoute } from "./route-parser";
import { navigateToRoute } from "./navigation";

let indexer: RouteIndexer | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("ASP.NET Route Lens");
  context.subscriptions.push(outputChannel);

  indexer = new RouteIndexer(outputChannel);
  context.subscriptions.push({ dispose: () => indexer?.dispose() });

  const symbolProvider = new RouteSymbolProvider(indexer);
  const providerDisposable = vscode.languages.registerWorkspaceSymbolProvider(symbolProvider);
  context.subscriptions.push(providerDisposable);

  const treeProvider = new RouteTreeProvider(indexer);
  const treeView = vscode.window.createTreeView("aspnet-route-lens.routeExplorer", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);
  context.subscriptions.push({ dispose: () => treeProvider.dispose() });

  const applyFilter = (text: string) => {
    treeProvider.setFilter(text);
    treeView.description = text ? `"${text}"` : undefined;
    vscode.commands.executeCommand(
      "setContext",
      "aspnet-route-lens.hasFilter",
      text.length > 0
    );
  };

  const filterCommand = vscode.commands.registerCommand(
    "aspnet-route-lens.filterRoutes",
    async () => {
      const input = await vscode.window.showInputBox({
        prompt: "Filter endpoints",
        value: treeProvider.getFilter(),
        placeHolder: "Method, path or controller  —  e.g. GET, /api/users, UserController",
      });
      if (input !== undefined) {
        applyFilter(input);
      }
    }
  );
  context.subscriptions.push(filterCommand);

  const clearFilterCommand = vscode.commands.registerCommand(
    "aspnet-route-lens.clearFilter",
    () => applyFilter("")
  );
  context.subscriptions.push(clearFilterCommand);

  const openRouteCommand = vscode.commands.registerCommand(
    "aspnet-route-lens.openRoute",
    (route: ParsedRoute) => void navigateToRoute(route)
  );
  context.subscriptions.push(openRouteCommand);

  const rebuildCommand = vscode.commands.registerCommand(
    "aspnet-route-lens.rebuildIndex",
    async () => {
      outputChannel.show(true);
      await indexer!.buildIndex();
      vscode.window.showInformationMessage(
        `ASP.NET Route Lens: Indexed ${indexer!.routeCount} routes across ${indexer!.fileCount} files.`
      );
    }
  );
  context.subscriptions.push(rebuildCommand);

  indexer.buildIndex().catch((err) => {
    outputChannel.appendLine(`[RouteIndexer] Initial build failed: ${err}`);
  });
}

export function deactivate(): void {
  indexer?.dispose();
  indexer = undefined;
}
