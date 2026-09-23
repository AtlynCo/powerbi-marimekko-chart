import { defineConfig } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(resolve(".tmp", "browsers"))) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(".tmp", "browsers");
}
const cache = resolve(".tmp", "browser", "cache");
mkdirSync(cache, { recursive: true });
process.env.TEMP = cache;
process.env.TMP = cache;
process.env.TMPDIR = cache;
process.env.npm_config_cache = resolve(".tmp", "npm-cache");
const evidence = process.env.QUALITY_CAPTURE === "1";
const benchmark = process.env.QUALITY_BENCHMARK === "1";

export default defineConfig({
    testDir: "./tests/browser",
    testMatch: evidence ? "**/evidence.spec.ts" : benchmark ? "**/benchmark.spec.ts" : "**/*.spec.ts",
    testIgnore: evidence || benchmark ? [] : ["**/evidence.spec.ts", "**/benchmark.spec.ts"],
    outputDir: "./.tmp/browser/results",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: evidence || benchmark ? "list" : [
        ["list"], ["json", { outputFile: resolve(".tmp", "quality-evidence",
            process.env.QUALITY_LABEL === "final" ? "final" : "", "functional-results.json") }]
    ],
    timeout: 30_000,
    use: {
        browserName: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
        headless: true,
        viewport: { width: 1100, height: 850 },
        screenshot: benchmark ? "off" : "only-on-failure",
        trace: benchmark ? "off" : "retain-on-failure"
    }
});
