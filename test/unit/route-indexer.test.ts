import { describe, it, expect, vi, beforeEach } from "vitest";
import { workspace, window } from "vscode";
import { RouteIndexer } from "../../src/route-indexer";

const USERS_CS = "/project/Controllers/UsersController.cs";
const ORDERS_CS = "/project/Controllers/OrdersController.cs";

const USERS_CONTENT = `
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult GetById(int id) { return Ok(); }
    [HttpPost]
    public IActionResult Create() { return Ok(); }
}
`;

const ORDERS_CONTENT = `
app.MapGet("/api/orders", GetOrders);
app.MapPost("/api/orders", CreateOrder);
`;

function makeUri(fsPath: string) {
  return { toString: () => `file://${fsPath}`, fsPath };
}

function setupFindFiles(uris: ReturnType<typeof makeUri>[]) {
  vi.mocked(workspace.findFiles).mockResolvedValue(uris as any);
}

function setupReadFile(fsPath: string, content: string) {
  vi.mocked(workspace.fs.stat).mockResolvedValue({ size: content.length } as any);
  vi.mocked(workspace.fs.readFile).mockImplementation(async (uri: any) => {
    if (uri.fsPath === fsPath) return Buffer.from(content);
    return Buffer.from("");
  });
}

async function createIndexer(): Promise<RouteIndexer> {
  const outputChannel = window.createOutputChannel("test");
  return new RouteIndexer(outputChannel as any);
}

describe("RouteIndexer.buildIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("indexes routes from discovered files", async () => {
    const usersUri = makeUri(USERS_CS);
    setupFindFiles([usersUri]);
    vi.mocked(workspace.fs.stat).mockResolvedValue({ size: USERS_CONTENT.length } as any);
    vi.mocked(workspace.fs.readFile).mockResolvedValue(Buffer.from(USERS_CONTENT) as any);

    const indexer = await createIndexer();
    await indexer.buildIndex();

    expect(indexer.routeCount).toBe(2);
    expect(indexer.fileCount).toBe(1);

    indexer.dispose();
  });

  it("indexes routes from multiple files", async () => {
    const uris = [makeUri(USERS_CS), makeUri(ORDERS_CS)];
    setupFindFiles(uris);

    vi.mocked(workspace.fs.stat).mockResolvedValue({ size: 100 } as any);
    vi.mocked(workspace.fs.readFile).mockImplementation(async (uri: any) => {
      if (uri.fsPath === USERS_CS) return Buffer.from(USERS_CONTENT) as any;
      if (uri.fsPath === ORDERS_CS) return Buffer.from(ORDERS_CONTENT) as any;
      return Buffer.from("") as any;
    });

    const indexer = await createIndexer();
    await indexer.buildIndex();

    expect(indexer.routeCount).toBe(4);
    expect(indexer.fileCount).toBe(2);

    indexer.dispose();
  });

  it("skips files larger than 1MB", async () => {
    const uri = makeUri(USERS_CS);
    setupFindFiles([uri]);
    vi.mocked(workspace.fs.stat).mockResolvedValue({ size: 1024 * 1024 + 1 } as any);

    const indexer = await createIndexer();
    await indexer.buildIndex();

    expect(indexer.routeCount).toBe(0);
    expect(workspace.fs.readFile).not.toHaveBeenCalled();

    indexer.dispose();
  });

  it("handles files with no routes gracefully (not added to index)", async () => {
    const uri = makeUri(USERS_CS);
    setupFindFiles([uri]);
    vi.mocked(workspace.fs.stat).mockResolvedValue({ size: 10 } as any);
    vi.mocked(workspace.fs.readFile).mockResolvedValue(Buffer.from("public class Helper {}") as any);

    const indexer = await createIndexer();
    await indexer.buildIndex();

    expect(indexer.routeCount).toBe(0);
    expect(indexer.fileCount).toBe(0);

    indexer.dispose();
  });
});

describe("RouteIndexer.removeFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes file routes from index", async () => {
    const uri = makeUri(USERS_CS);
    setupFindFiles([uri]);
    vi.mocked(workspace.fs.stat).mockResolvedValue({ size: USERS_CONTENT.length } as any);
    vi.mocked(workspace.fs.readFile).mockResolvedValue(Buffer.from(USERS_CONTENT) as any);

    const indexer = await createIndexer();
    await indexer.buildIndex();
    expect(indexer.routeCount).toBe(2);

    indexer.removeFile(uri as any);
    expect(indexer.routeCount).toBe(0);
    expect(indexer.fileCount).toBe(0);

    indexer.dispose();
  });
});

describe("RouteIndexer.search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function buildWithContent(content: string) {
    const uri = makeUri(USERS_CS);
    setupFindFiles([uri]);
    vi.mocked(workspace.fs.stat).mockResolvedValue({ size: content.length } as any);
    vi.mocked(workspace.fs.readFile).mockResolvedValue(Buffer.from(content) as any);

    const indexer = await createIndexer();
    await indexer.buildIndex();
    return indexer;
  }

  it("returns all routes when query is empty string", async () => {
    const indexer = await buildWithContent(USERS_CONTENT);
    const results = indexer.search("");
    expect(results).toHaveLength(2);
    indexer.dispose();
  });

  it("filters by path segment", async () => {
    const indexer = await buildWithContent(USERS_CONTENT);
    const results = indexer.search("users");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.path.toLowerCase().includes("users"))).toBe(true);
    indexer.dispose();
  });

  it("filters by HTTP method", async () => {
    const indexer = await buildWithContent(USERS_CONTENT);
    const results = indexer.search("GET");
    expect(results).toHaveLength(1);
    expect(results[0].method).toBe("GET");
    indexer.dispose();
  });

  it("matches combined method + path query", async () => {
    const indexer = await buildWithContent(USERS_CONTENT);
    const results = indexer.search("get /api/users");
    expect(results.length).toBeGreaterThan(0);
    indexer.dispose();
  });

  it("returns empty array when no routes match", async () => {
    const indexer = await buildWithContent(USERS_CONTENT);
    const results = indexer.search("nonexistent-xyz-route");
    expect(results).toHaveLength(0);
    indexer.dispose();
  });

  it("search is case-insensitive", async () => {
    const indexer = await buildWithContent(USERS_CONTENT);
    const upper = indexer.search("USERS");
    const lower = indexer.search("users");
    expect(upper.length).toBe(lower.length);
    indexer.dispose();
  });
});

describe("RouteIndexer.dispose", () => {
  it("disposes watcher", async () => {
    vi.clearAllMocks();

    const watcherDispose = vi.fn();
    vi.mocked(workspace.createFileSystemWatcher).mockReturnValue({
      onDidCreate: vi.fn(),
      onDidChange: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: watcherDispose,
    } as any);

    setupFindFiles([]);
    const indexer = await createIndexer();
    indexer.dispose();

    expect(watcherDispose).toHaveBeenCalled();
  });
});
