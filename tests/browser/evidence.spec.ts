import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mount, readPackagedVisual } from "./host";
import { assertAreaOracle, readLayout, plotGeometry, REPORT_FIXTURE, REQUESTED_VIEWPORTS } from "./oracles";
import { sampleFixture } from "./sample-fixtures";

// Explicit opt-in: QUALITY_CAPTURE=1, QUALITY_LABEL=baseline|candidate; PBIVIZ_PACKAGE may pin an archived package.
test("capture packaged local viewport evidence without relabeling it as final", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const label = process.env.QUALITY_LABEL ?? "candidate";
    const viewportMatrix = process.env.QUALITY_VIEWPORT_MATRIX === "1";
    if (!/^(baseline|candidate|final)$/.test(label)) throw new Error("Unknown evidence label");
    if (label === "final" && process.env.QUALITY_UI_FROZEN !== "1") throw new Error("Final screenshots require an explicitly frozen UI");
    if (viewportMatrix && label !== "final") throw new Error("Current viewport evidence belongs to the final run");
    const directory = resolve(".tmp", "quality-evidence", label, viewportMatrix ? "current-viewports" : "");
    await mkdir(directory, { recursive: true });
    const packaged = await readPackagedVisual();
    const archivedPackage = `${packaged.info.guid}.${packaged.info.version}.${packaged.info.sha256.slice(0, 12)}.pbiviz`;
    await writeFile(resolve(directory, archivedPackage), packaged.archive);
    const captures = [];
    const scenarios = label === "final" && !viewportMatrix ?
        (await Promise.all([sampleFixture("market"), sampleFixture("product-mix")])).flatMap(sample =>
            [{ width: 1366, height: 768 }, { width: 1280, height: 720 }].map(size => ({ ...sample, size }))) :
        REQUESTED_VIEWPORTS.map(size => ({ kind: "report", fixture: REPORT_FIXTURE, source: null, size }));
    for (const { kind, fixture, source, size } of scenarios) {
        await page.setViewportSize(size);
        const requests = await mount(page, fixture);
        await page.evaluate(size => window.harness.update(undefined, size.width, size.height), size);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (label === "final" && size.width !== 80) await assertAreaOracle(page, fixture);
        if (label === "final" && size.width === 80) await expect(page.locator(".chart")).toHaveCount(0);
        const name = `${label}-${kind}-${size.width}x${size.height}.png`;
        await page.screenshot({ path: resolve(directory, name), animations: "disabled" });
        captures.push({ image: name, size, fixture, source, layout: await readLayout(page), geometry: await plotGeometry(page) });
        expect(requests).toEqual([]);
    }
    await writeFile(resolve(directory, `${label}-viewport-evidence.json`), JSON.stringify({
        label, purpose: viewportMatrix ? "Nonmarketing responsive viewport validation" : "Packaged visual sample capture",
        generatedAt: new Date().toISOString(), package: packaged.info, archivedPackage, chromium: browser.version(),
        provenance: "Actual extracted PBIVIZ JS/CSS in isolated local Playwright Chromium. Mock SDK host, not native Power BI. Final scenario values and measure formats are read from the shipped CSVs/semantic model; earlier report scenarios are synthetic fixtures.",
        screenshotsNotNativeHostProof: true, captures
    }, null, 2));
});
