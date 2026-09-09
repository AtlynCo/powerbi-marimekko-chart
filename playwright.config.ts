import { defineConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".tmp", "browsers");
const cache = resolve(".tmp", "browser", "cache");
mkdirSync(cache, { recursive: true });
process.env.TEMP = cache;
process.env.TMP = cache;
process.env.TMPDIR = cache;

export default defineConfig({
    testDir: "./tests/browser",
    outputDir: "./.tmp/browser/results",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: "list",
    timeout: 30_000,
    use: {
        browserName: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
        headless: true,
        viewport: { width: 1100, height: 850 },
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    }
});
