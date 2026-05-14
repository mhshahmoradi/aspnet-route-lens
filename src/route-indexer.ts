import * as vscode from "vscode";
import { parseRoutes, ParsedRoute } from "./route-parser";
import { RouteIndex } from "./route-index";

const SCAN_INCLUDE = "**/*.cs";
const SCAN_EXCLUDE = "**/bin/**,**/obj/**,**/node_modules/**,.git/**";
const DEBOUNCE_MS = 300;
const MAX_FILE_SIZE_BYTES = 1024 * 1024;

export class RouteIndexer {
  private readonly index = new RouteIndex();
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private buildPromise: Promise<void> | null = null;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange: vscode.Event<void> = this._onDidChange.event;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.watcher = vscode.workspace.createFileSystemWatcher(SCAN_INCLUDE);
    this.watcher.onDidCreate((uri) => this.scheduleReindex(uri));
    this.watcher.onDidChange((uri) => this.scheduleReindex(uri));
    this.watcher.onDidDelete((uri) => this.removeFile(uri));
  }

  async buildIndex(): Promise<void> {
    if (this.buildPromise) return this.buildPromise;
    this.buildPromise = this.doBuildIndex().finally(() => {
      this.buildPromise = null;
    });
    return this.buildPromise;
  }

  private async doBuildIndex(): Promise<void> {
    this.index.clear();
    const files = await vscode.workspace.findFiles(SCAN_INCLUDE, `{${SCAN_EXCLUDE}}`);
    this.outputChannel.appendLine(`[RouteIndexer] Scanning ${files.length} C# files…`);

    await Promise.all(files.map((uri) => this.indexFile(uri)));
    this.outputChannel.appendLine(
      `[RouteIndexer] Indexed ${this.index.routeCount} routes across ${this.index.fileCount} files.`
    );
    this._onDidChange.fire();
  }

  async indexFile(uri: vscode.Uri): Promise<void> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > MAX_FILE_SIZE_BYTES) {
        this.outputChannel.appendLine(`[RouteIndexer] Skipping large file: ${uri.fsPath}`);
        return;
      }

      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString("utf8");
      const routes = parseRoutes(content, uri.fsPath);

      if (routes.length > 0) {
        this.index.set(uri.toString(), routes);
      } else {
        this.index.delete(uri.toString());
      }
    } catch (err) {
      this.outputChannel.appendLine(`[RouteIndexer] Error indexing ${uri.fsPath}: ${err}`);
    }
  }

  removeFile(uri: vscode.Uri): void {
    this.index.delete(uri.toString());
    this._onDidChange.fire();
  }

  getAllRoutes(): ParsedRoute[] {
    return this.index.getAllRoutes();
  }

  search(query: string): ParsedRoute[] {
    return this.index.search(query);
  }

  get fileCount(): number {
    return this.index.fileCount;
  }

  get routeCount(): number {
    return this.index.routeCount;
  }

  private scheduleReindex(uri: vscode.Uri): void {
    const key = uri.toString();
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      await this.indexFile(uri);
      this._onDidChange.fire();
    }, DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }

  dispose(): void {
    this.watcher.dispose();
    this._onDidChange.dispose();
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.index.clear();
  }
}
