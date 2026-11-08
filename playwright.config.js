import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "tests", testIgnore: ["from-app/**"], reporter: "list" });
