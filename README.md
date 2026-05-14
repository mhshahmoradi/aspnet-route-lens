# ASP.NET Route Lens

Tired of ctrl+clicking through controllers just to find where a route lives? This extension scans your ASP.NET Core project and shows all your HTTP endpoints in a sidebar panel. Click one and you're right there.

It picks up attribute routing (`[HttpGet]`, `[Route]`, etc.) and minimal API calls (`app.MapGet`, `app.MapPost`, ...). You can also search endpoints right in the panel — by method, path, or controller name.

Routes also show up in the **Go to Symbol in Workspace** picker (Ctrl+T), so you can jump to `GET /api/users/{id}` the same way you'd jump to a class.

## Features

- Sidebar panel listing all endpoints grouped by controller
- Click any route to go to the exact line in the source file
- Filter by method, path, or controller name
- Works with both attribute routing and minimal APIs
- Live updates as you edit — no manual refresh needed

## Contributing

Feel free to open an issue or pull request. The parser lives in `src/route-parser.ts` and has no VS Code dependency, so it's easy to extend and test. If there's a routing pattern we're missing, that's the right place to add it.
