import { describe, it, expect, vi } from "vitest";
import { SymbolKind, CancellationToken } from "vscode";
import { RouteSymbolProvider } from "../../src/symbol-provider";
import type { ParsedRoute } from "../../src/route-parser";

const FILE = "/project/Controllers/UsersController.cs";

function makeRoute(overrides: Partial<ParsedRoute> = {}): ParsedRoute {
  return {
    method: "GET",
    path: "/api/users",
    line: 10,
    column: 5,
    containerName: "UsersController",
    filePath: FILE,
    ...overrides,
  };
}

function makeIndexer(routes: ParsedRoute[]) {
  return {
    search: vi.fn((query: string) => {
      const lower = query.toLowerCase();
      if (!lower) return routes;
      return routes.filter(
        (r) =>
          r.path.toLowerCase().includes(lower) ||
          r.method.toLowerCase().includes(lower) ||
          `${r.method.toLowerCase()} ${r.path.toLowerCase()}`.includes(lower)
      );
    }),
    buildIndex: vi.fn(),
    fileCount: 0,
    routeCount: routes.length,
    dispose: vi.fn(),
  };
}

describe("RouteSymbolProvider.provideWorkspaceSymbols", () => {
  it("returns empty array when token is cancelled", async () => {
    const provider = new RouteSymbolProvider(makeIndexer([makeRoute()]) as any);
    const token = { isCancellationRequested: true, onCancellationRequested: vi.fn() };
    const result = await provider.provideWorkspaceSymbols("users", token as any);
    expect(result).toEqual([]);
  });

  it("returns SymbolInformation for each matched route", async () => {
    const routes = [
      makeRoute({ method: "GET", path: "/api/users" }),
      makeRoute({ method: "POST", path: "/api/users" }),
    ];
    const provider = new RouteSymbolProvider(makeIndexer(routes) as any);
    const result = await provider.provideWorkspaceSymbols("users", CancellationToken as any);

    expect(result).toHaveLength(2);
  });

  it("maps method and path into the symbol name", async () => {
    const route = makeRoute({ method: "GET", path: "/api/users/{id}" });
    const provider = new RouteSymbolProvider(makeIndexer([route]) as any);
    const result = (await provider.provideWorkspaceSymbols("", CancellationToken as any))!;

    expect(result[0].name).toBe("GET /api/users/{id}");
  });

  it("sets symbol kind to Function", async () => {
    const provider = new RouteSymbolProvider(makeIndexer([makeRoute()]) as any);
    const result = (await provider.provideWorkspaceSymbols("", CancellationToken as any))!;

    expect(result[0].kind).toBe(SymbolKind.Function);
  });

  it("sets containerName from route", async () => {
    const route = makeRoute({ containerName: "OrdersController" });
    const provider = new RouteSymbolProvider(makeIndexer([route]) as any);
    const result = (await provider.provideWorkspaceSymbols("", CancellationToken as any))!;

    expect(result[0].containerName).toBe("OrdersController");
  });

  it("sets location with correct line (1-indexed to 0-indexed)", async () => {
    const route = makeRoute({ line: 15, column: 5, filePath: FILE });
    const provider = new RouteSymbolProvider(makeIndexer([route]) as any);
    const result = (await provider.provideWorkspaceSymbols("", CancellationToken as any))!;

    const pos = result[0].location.range.start;
    expect(pos.line).toBe(14);
    expect(pos.character).toBe(4);
  });

  it("returns empty array when index has no routes matching query", async () => {
    const provider = new RouteSymbolProvider(makeIndexer([]) as any);
    const result = await provider.provideWorkspaceSymbols("anything", CancellationToken as any);
    expect(result).toHaveLength(0);
  });

  it("passes the query string to the indexer", async () => {
    const indexer = makeIndexer([makeRoute()]);
    const provider = new RouteSymbolProvider(indexer as any);
    await provider.provideWorkspaceSymbols("myquery", CancellationToken as any);
    expect(indexer.search).toHaveBeenCalledWith("myquery");
  });

  it("handles Minimal API containerName", async () => {
    const route = makeRoute({ containerName: "Minimal API", path: "/health" });
    const provider = new RouteSymbolProvider(makeIndexer([route]) as any);
    const result = (await provider.provideWorkspaceSymbols("", CancellationToken as any))!;

    expect(result[0].containerName).toBe("Minimal API");
  });
});
