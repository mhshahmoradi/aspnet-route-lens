import { describe, it, expect } from "vitest";
import { parseRoutes } from "../../src/route-parser";

const FILE = "/project/Controllers/UsersController.cs";

describe("parseRoutes – attribute routing", () => {
  it("parses HttpGet with a route segment on a controller method", () => {
    const content = `
namespace MyApp;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/api/users/{id}");
    expect(routes[0].containerName).toBe("UsersController");
  });

  it("parses HttpPost with no route segment and uses base route only", () => {
    const content = `
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    [HttpPost]
    public IActionResult Create([FromBody] Order order)
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("POST");
    expect(routes[0].path).toBe("/api/orders");
  });

  it("parses HttpPut with route segment", () => {
    const content = `
[Route("api/products")]
public class ProductsController : ControllerBase
{
    [HttpPut("{id}")]
    public IActionResult Update(int id)
    {
        return NoContent();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("PUT");
    expect(routes[0].path).toBe("/api/products/{id}");
  });

  it("parses HttpDelete with route constraint", () => {
    const content = `
[Route("api/items")]
public class ItemsController : ControllerBase
{
    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        return NoContent();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("DELETE");
    expect(routes[0].path).toBe("/api/items/{id:int}");
  });

  it("parses HttpPatch", () => {
    const content = `
[Route("v1/accounts")]
public class AccountsController : ControllerBase
{
    [HttpPatch("{id}")]
    public IActionResult Patch(int id)
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("PATCH");
    expect(routes[0].path).toBe("/v1/accounts/{id}");
  });

  it("expands [controller] token to lowercase controller name without suffix", () => {
    const content = `
[Route("api/[controller]")]
public class ShoppingCartController : ControllerBase
{
    [HttpGet]
    public IActionResult GetCart()
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/api/shoppingcart");
  });

  it("parses multiple methods on the same controller", () => {
    const content = `
[Route("api/[controller]")]
public class BlogsController : ControllerBase
{
    [HttpGet]
    public IActionResult List()
    {
        return Ok();
    }

    [HttpPost]
    public IActionResult Create()
    {
        return Ok();
    }

    [HttpGet("{slug}")]
    public IActionResult GetBySlug(string slug)
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      "GET /api/blogs",
      "POST /api/blogs",
      "GET /api/blogs/{slug}",
    ]);
  });

  it("returns correct line numbers for each route attribute", () => {
    const content = `using System;

[Route("api/[controller]")]
public class LogsController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult Get(int id) { return Ok(); }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].line).toBe(6);
  });

  it("handles controller with no Route attribute (no base route)", () => {
    const content = `
public class NoBaseController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() { return Ok(); }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/health");
  });

  it("parses [HttpGet(Name = '...')] with no path – uses base route", () => {
    const content = `
[ApiController]
[Route("[controller]")]
public class WeatherForecastController : ControllerBase
{
    [HttpGet(Name = "GetWeatherForecast")]
    public IEnumerable<WeatherForecast> Get()
    {
        return Enumerable.Empty<WeatherForecast>();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/weatherforecast");
    expect(routes[0].containerName).toBe("WeatherForecastController");
  });

  it("parses [HttpGet('path', Name = '...')] – uses path, ignores name param", () => {
    const content = `
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    [HttpGet("{id}", Name = "GetProductById")]
    public IActionResult GetById(int id)
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/api/products/{id}");
  });

  it("parses [HttpPost(Name = '...')] – uses base route only", () => {
    const content = `
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpPost(Name = "CreateOrder")]
    public IActionResult Create()
    {
        return Ok();
    }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("POST");
    expect(routes[0].path).toBe("/api/orders");
  });
});

describe("parseRoutes – minimal API", () => {
  it("parses app.MapGet", () => {
    const content = `
var app = builder.Build();
app.MapGet("/api/users", GetUsers);
app.Run();
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("GET");
    expect(routes[0].path).toBe("/api/users");
    expect(routes[0].containerName).toBe("Minimal API");
  });

  it("parses app.MapPost", () => {
    const content = `app.MapPost("/api/users", CreateUser);`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("POST");
    expect(routes[0].path).toBe("/api/users");
  });

  it("parses app.MapPut", () => {
    const content = `app.MapPut("/api/users/{id}", UpdateUser);`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("PUT");
    expect(routes[0].path).toBe("/api/users/{id}");
  });

  it("parses app.MapDelete", () => {
    const content = `app.MapDelete("/api/users/{id}", DeleteUser);`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("DELETE");
  });

  it("parses app.MapPatch", () => {
    const content = `app.MapPatch("/api/users/{id}", PatchUser);`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("PATCH");
  });

  it("normalises path that does not start with /", () => {
    const content = `app.MapGet("api/health", HealthCheck);`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/api/health");
  });

  it("parses multiple minimal API routes", () => {
    const content = `
app.MapGet("/products", GetProducts);
app.MapPost("/products", CreateProduct);
app.MapDelete("/products/{id}", DeleteProduct);
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.method)).toEqual(["GET", "POST", "DELETE"]);
  });

  it("handles chained builder pattern", () => {
    const content = `
app.UseRouting()
   .MapGet("/ping", () => "pong");
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/ping");
  });
});

describe("parseRoutes – mixed file", () => {
  it("collects both attribute and minimal API routes from same file", () => {
    const content = `
app.MapGet("/health", HealthCheck);

[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet("{id}")]
    public IActionResult GetUser(int id) { return Ok(); }
}
`;
    const routes = parseRoutes(content, FILE);
    expect(routes).toHaveLength(2);
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/health");
    expect(paths).toContain("/api/users/{id}");
  });
});

describe("parseRoutes – edge cases", () => {
  it("returns empty array for file with no routes", () => {
    const content = `
namespace MyApp;
public class Helper
{
    public string Greet(string name) => $"Hello, {name}";
}
`;
    expect(parseRoutes(content, FILE)).toHaveLength(0);
  });

  it("returns empty array for empty content", () => {
    expect(parseRoutes("", FILE)).toHaveLength(0);
  });

  it("does not crash on malformed attribute syntax", () => {
    const content = `
[HttpGet(
public class Broken { }
`;
    expect(() => parseRoutes(content, FILE)).not.toThrow();
  });
});
