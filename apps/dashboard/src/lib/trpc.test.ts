import { describe, it, expect } from "vitest";
import { trpc } from "./trpc";

describe("trpc client", () => {
  it("re-exports a trpc object from the providers module", () => {
    expect(trpc).toBeDefined();
  });

  it("exposes the expected router namespaces", () => {
    expect(trpc.vault).toBeDefined();
    expect(trpc.agent).toBeDefined();
    expect(trpc.transaction).toBeDefined();
    expect(trpc.risk).toBeDefined();
    expect(trpc.stats).toBeDefined();
  });
});
