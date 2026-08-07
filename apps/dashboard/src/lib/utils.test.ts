import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins multiple class strings with a space", () => {
    expect(cn("px-2", "py-4", "m-1")).toBe("px-2 py-4 m-1");
  });

  it("dedupes conflicting tailwind classes (tailwind-merge wins with last value)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("dedupes tailwind classes inside a single string", () => {
    expect(cn("px-2 px-4")).toBe("px-4");
    expect(cn("p-4 m-2 m-6")).toBe("p-4 m-6");
  });

  it("handles falsy values by ignoring them", () => {
    expect(cn("px-2", null, undefined, false, "")).toBe("px-2");
    expect(cn(null, undefined, false, "")).toBe("");
  });

  it("combines conditional strings", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  it("supports object inputs via clsx", () => {
    expect(cn({ "px-2": true, "py-4": false })).toBe("px-2");
    expect(cn({ "px-2": false }, { "px-4": true })).toBe("px-4");
  });

  it("supports arrays and nested arrays", () => {
    expect(cn(["px-2", "py-4"], "m-2")).toBe("px-2 py-4 m-2");
    expect(cn(["px-2", ["py-4", "m-2"]])).toBe("px-2 py-4 m-2");
  });

  it("handles arbitrary values and dedupes against them", () => {
    expect(cn("p-2", "p-[10px]")).toBe("p-[10px]");
    expect(cn("w-4", "w-[100%]")).toBe("w-[100%]");
  });

  it("merges across conflict groups independently", () => {
    expect(cn("px-2", "py-2", "px-4", "py-4")).toBe("px-4 py-4");
    expect(cn("m-1", "mt-2", "mb-3")).toBe("m-1 mt-2 mb-3");
  });

  it("keeps non-conflicting classes from both inputs", () => {
    expect(cn("font-bold", "text-sm")).toBe("font-bold text-sm");
    expect(cn("rounded-lg", "border", "shadow-sm")).toBe("rounded-lg border shadow-sm");
  });

  it("supports template literal / computed values", () => {
    const size = "lg";
    expect(cn(`h-${size}`, "w-full")).toBe("h-lg w-full");
  });

  it("handles a mix of all input kinds at once", () => {
    expect(cn("px-2", { "px-4": false }, null, ["py-4", "m-2"], true && "text-center")).toBe(
      "px-2 py-4 m-2 text-center"
    );
  });

  it("returns an empty string when nothing is passed", () => {
    expect(cn()).toBe("");
  });
});
