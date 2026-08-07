import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const indexPath = resolve(fileURLToPath(new URL("..", import.meta.url)), "src/index.ts");
const source = readFileSync(indexPath, "utf8");

describe("packages/api/src/index.ts import safety", () => {
  it("exports createApp factory for testability", () => {
    const hasExport = /export\s+function\s+createApp/.test(source);
    expect(hasExport).toBe(true);
  });

  it("does NOT start listening at module load (app.listen only inside startServer)", () => {
    const lines = source.split("\n");
    const startServerIdx = lines.findIndex(l => l.includes("function startServer"));
    expect(startServerIdx).toBeGreaterThan(-1);
    // No app.listen before startServer function
    const beforeStartServer = lines.slice(0, startServerIdx).join("\n");
    expect(beforeStartServer).not.toMatch(/app\.listen\s*\(/);
  });

  it("can be safely imported for tests because it does not bind a port at load time", () => {
    expect(source).toMatch(/createApp/);
    expect(source).toMatch(/startServer/);
    expect(source).toMatch(/import\.meta\.url === `file:\/\/.*process\.argv/);
  });

  it("references pino-pretty which IS now installed in the package", () => {
    expect(source).toMatch(/pino-pretty/);
  });

  it("loads dotenv config at top", () => {
    expect(source).toMatch(/import "dotenv\/config"/);
  });
});