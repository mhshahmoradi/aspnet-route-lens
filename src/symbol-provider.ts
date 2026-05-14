import * as vscode from "vscode";
import { RouteIndexer } from "./route-indexer";
import { ParsedRoute } from "./route-parser";

const ROUTE_KIND = vscode.SymbolKind.Function;

export class RouteSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(private readonly indexer: RouteIndexer) {}

  provideWorkspaceSymbols(
    query: string,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SymbolInformation[]> {
    if (token.isCancellationRequested) return [];

    const routes = this.indexer.search(query);
    return routes.map((route) => this.toSymbolInformation(route));
  }

  private toSymbolInformation(route: ParsedRoute): vscode.SymbolInformation {
    const uri = vscode.Uri.file(route.filePath);
    const position = new vscode.Position(route.line - 1, route.column - 1);
    const location = new vscode.Location(uri, position);

    return new vscode.SymbolInformation(
      `${route.method} ${route.path}`,
      ROUTE_KIND,
      route.containerName,
      location
    );
  }
}
