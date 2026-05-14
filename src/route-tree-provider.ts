import * as vscode from "vscode";
import * as path from "path";
import { RouteIndexer } from "./route-indexer";
import { HttpMethod, ParsedRoute } from "./route-parser";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "charts.green",
  POST: "charts.blue",
  PUT: "charts.yellow",
  DELETE: "charts.red",
  PATCH: "charts.purple",
  HEAD: "disabledForeground",
  OPTIONS: "disabledForeground",
  ANY: "disabledForeground",
};

class RouteGroupItem extends vscode.TreeItem {
  constructor(
    readonly groupName: string,
    readonly routes: ParsedRoute[]
  ) {
    super(groupName, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon("symbol-class");
    this.description = `${routes.length}`;
    this.contextValue = "routeGroup";
  }
}

class RouteItem extends vscode.TreeItem {
  constructor(readonly route: ParsedRoute) {
    super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(
      "circle-filled",
      new vscode.ThemeColor(METHOD_COLORS[route.method] ?? "disabledForeground")
    );
    this.description = path.basename(route.filePath);
    this.tooltip = new vscode.MarkdownString(
      `**${route.method}** \`${route.path}\`\n\n${route.filePath}:${route.line}`
    );
    this.command = {
      command: "aspnet-route-lens.openRoute",
      title: "Go to Route",
      arguments: [route],
    };
    this.contextValue = "route";
  }
}

type RouteTreeItem = RouteGroupItem | RouteItem;

export class RouteTreeProvider implements vscode.TreeDataProvider<RouteTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;
  private filterText = "";

  constructor(private readonly indexer: RouteIndexer) {
    indexer.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  setFilter(text: string): void {
    this.filterText = text.trim().toLowerCase();
    this._onDidChangeTreeData.fire();
  }

  getFilter(): string {
    return this.filterText;
  }

  getTreeItem(element: RouteTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RouteTreeItem): RouteTreeItem[] {
    if (!element) {
      return this.buildGroups();
    }
    if (element instanceof RouteGroupItem) {
      return element.routes
        .slice()
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((r) => new RouteItem(r));
    }
    return [];
  }

  private buildGroups(): RouteGroupItem[] {
    const routes = this.indexer.search(this.filterText);

    const map = new Map<string, ParsedRoute[]>();
    for (const route of routes) {
      const existing = map.get(route.containerName) ?? [];
      existing.push(route);
      map.set(route.containerName, existing);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, rs]) => new RouteGroupItem(name, rs));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
