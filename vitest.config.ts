import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      vscode: resolve(__dirname, "test/__mocks__/vscode.ts"),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
    globals: false,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/extension.ts"],
    },
  },
});
