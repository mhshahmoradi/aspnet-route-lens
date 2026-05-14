export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS" | "ANY";

export interface ParsedRoute {
  method: HttpMethod;
  path: string;
  line: number;
  column: number;
  containerName: string;
  filePath: string;
}

const HTTP_VERB_MAP: Record<string, HttpMethod> = {
  HttpGet: "GET",
  HttpPost: "POST",
  HttpPut: "PUT",
  HttpDelete: "DELETE",
  HttpPatch: "PATCH",
  HttpHead: "HEAD",
  HttpOptions: "OPTIONS",
  MapGet: "GET",
  MapPost: "POST",
  MapPut: "PUT",
  MapDelete: "DELETE",
  MapPatch: "PATCH",
  MapMethods: "ANY",
};

const CONTROLLER_CLASS_RE =
  /^\s*(?:public\s+|internal\s+|sealed\s+|abstract\s+|partial\s+)*class\s+(\w+)\s*(?::\s*[\w<>,\s]+)?/;

const CLASS_ROUTE_ATTR_RE = /\[Route\(\s*"([^"]+)"\s*\)/;

const HTTP_VERB_ATTR_RE =
  /\[(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch|HttpHead|HttpOptions)\s*(?:\((?:\s*"([^"]*)"[^)]*|[^)]*)\))?\]/;

const MINIMAL_API_RE =
  /\.(MapGet|MapPost|MapPut|MapDelete|MapPatch|MapHead|MapMethods)\s*\(\s*"([^"]+)"/;

const CONTROLLER_SUFFIX_RE = /Controller$/i;

interface ControllerContext {
  name: string;
  baseRoute: string;
}

function stripControllerSuffix(name: string): string {
  return name.replace(CONTROLLER_SUFFIX_RE, "");
}

function resolveTokens(template: string, controllerName: string): string {
  return template
    .replace(/\[controller\]/gi, stripControllerSuffix(controllerName).toLowerCase())
    .replace(/\[action\]/gi, "action");
}

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

function joinPaths(base: string, segment: string): string {
  if (!base) return normalizePath(segment);
  const left = normalizePath(base).replace(/\/$/, "");
  const right = segment.startsWith("/") ? segment : `/${segment}`;
  return left + right;
}

function normalizeMethod(attrName: string): HttpMethod {
  return HTTP_VERB_MAP[attrName] ?? "ANY";
}

export function parseRoutes(content: string, filePath: string): ParsedRoute[] {
  const lines = content.split("\n");
  const routes: ParsedRoute[] = [];

  let currentController: ControllerContext | null = null;
  let pendingClassRoute: string | null = null;
  let pendingHttpAttr: { method: HttpMethod; routeSegment: string; line: number; column: number } | null = null;
  let insideClassBody = false;
  let braceDepth = 0;
  let classBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNumber = i + 1;

    for (const char of raw) {
      if (char === "{") braceDepth++;
      else if (char === "}") braceDepth--;
    }

    if (insideClassBody && braceDepth < classBraceDepth) {
      currentController = null;
      pendingClassRoute = null;
      insideClassBody = false;
    }

    const classMatch = CONTROLLER_CLASS_RE.exec(raw);
    if (classMatch) {
      const className = classMatch[1];
      pendingClassRoute = null;
      currentController = { name: className, baseRoute: "" };
      classBraceDepth = braceDepth + 1;
      insideClassBody = false;

      if (i > 0) {
        for (let lookback = i - 1; lookback >= Math.max(0, i - 10); lookback--) {
          const prevLine = lines[lookback];
          const routeAttrMatch = CLASS_ROUTE_ATTR_RE.exec(prevLine);
          if (routeAttrMatch) {
            pendingClassRoute = routeAttrMatch[1];
            break;
          }
          if (/^\s*\[/.test(prevLine)) continue;
          if (/^\s*$/.test(prevLine)) continue;
          break;
        }
      }

      if (pendingClassRoute !== null) {
        currentController.baseRoute = resolveTokens(pendingClassRoute, className);
      }
      continue;
    }

    if (currentController && !insideClassBody && braceDepth >= classBraceDepth) {
      insideClassBody = true;
    }

    const httpAttrMatch = HTTP_VERB_ATTR_RE.exec(raw);
    if (httpAttrMatch) {
      pendingHttpAttr = {
        method: normalizeMethod(httpAttrMatch[1]),
        routeSegment: httpAttrMatch[2] ?? "",
        line: lineNumber,
        column: raw.indexOf("[") + 1,
      };
    }

    if (pendingHttpAttr && insideClassBody) {
      const methodDeclLine = raw;
      const isMethodDecl =
        /\b(public|private|protected|internal)\b/.test(methodDeclLine) &&
        /\w+\s*\(/.test(methodDeclLine);

      if (isMethodDecl) {
        const base = currentController?.baseRoute ?? "";
        const fullPath = pendingHttpAttr.routeSegment
          ? joinPaths(base, pendingHttpAttr.routeSegment)
          : base ? normalizePath(base) : "/";

        routes.push({
          method: pendingHttpAttr.method,
          path: fullPath,
          line: pendingHttpAttr.line,
          column: pendingHttpAttr.column,
          containerName: currentController?.name ?? "",
          filePath,
        });

        pendingHttpAttr = null;
      }
    }

    const minimalApiMatch = MINIMAL_API_RE.exec(raw);
    if (minimalApiMatch) {
      const method = normalizeMethod(minimalApiMatch[1]);
      const path = normalizePath(minimalApiMatch[2]);
      const column = raw.indexOf(minimalApiMatch[0]) + 1;

      routes.push({
        method,
        path,
        line: lineNumber,
        column,
        containerName: "Minimal API",
        filePath,
      });
    }
  }

  return routes;
}
