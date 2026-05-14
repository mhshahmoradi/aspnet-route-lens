import { ParsedRoute } from "./route-parser";

export class RouteIndex {
  private readonly store = new Map<string, ParsedRoute[]>();
  private flatCache: ParsedRoute[] | null = null;
  private _routeCount = 0;

  set(key: string, routes: ParsedRoute[]): void {
    const existing = this.store.get(key);
    if (existing) this._routeCount -= existing.length;
    this._routeCount += routes.length;
    this.store.set(key, routes);
    this.flatCache = null;
  }

  delete(key: string): void {
    const existing = this.store.get(key);
    if (existing) this._routeCount -= existing.length;
    this.store.delete(key);
    this.flatCache = null;
  }

  clear(): void {
    this.store.clear();
    this._routeCount = 0;
    this.flatCache = null;
  }

  getAllRoutes(): ParsedRoute[] {
    if (this.flatCache === null) {
      this.flatCache = [...this.store.values()].flat();
    }
    return this.flatCache;
  }

  search(query: string): ParsedRoute[] {
    const lower = query.toLowerCase().trim();
    if (!lower) return this.getAllRoutes();

    return this.getAllRoutes().filter(
      (r) =>
        r.path.toLowerCase().includes(lower) ||
        r.method.toLowerCase().includes(lower) ||
        r.containerName.toLowerCase().includes(lower) ||
        `${r.method} ${r.path}`.toLowerCase().includes(lower)
    );
  }

  get fileCount(): number {
    return this.store.size;
  }

  get routeCount(): number {
    return this._routeCount;
  }
}
