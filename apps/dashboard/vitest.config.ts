import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@arcswarm/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/components/**", "src/lib/**", "src/hooks/**"],
      exclude: ["**/*.stories.tsx", "src/components/ui/**", "**/*.test.{ts,tsx}"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
