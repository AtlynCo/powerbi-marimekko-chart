import { expect, test } from "@playwright/test";
import { mount, hostLog, type Fixture } from "./host";
import { assertAreaOracle, readLayout, REPORT_FIXTURE, REQUESTED_VIEWPORTS, seededFixture } from "./oracles";

test.afterEach(async ({ page }) => {
    const failures = await page.evaluate(() => Object.values(window.harnesses ?? {}).flatMap(harness => harness.log.failures));
    expect(failures).toEqual([]);
});

for (const size of REQUESTED_VIEWPORTS) {
    test(`quality layout ${size.width}x${size.height} preserves area or an accessible small state`, async ({ page }) => {
        await page.setViewportSize(size);
        await mount(page, REPORT_FIXTURE);
        await page.evaluate(size => window.harness.update(undefined, size.width, size.height), size);
        const layout = await readLayout(page);
        expect(layout.viewport).toEqual(size);
        expect(layout.controls.length).toBeGreaterThan(0);
        for (const control of layout.controls) expect(control.withinViewport, JSON.stringify(control)).toBe(true);
        if (size.width === 80) {
            await expect(page.locator(".chart")).toHaveCount(0);
            await expect(page.getByRole("button", { name: "Data table", exact: true })).toBeVisible();
            await expect(page.locator(".small-state")).toBeVisible();
        } else {
            await assertAreaOracle(page, REPORT_FIXTURE);
            expect(layout.chart?.withinViewport, "Dashboard geometry must fit the viewport without scrolling").toBe(true);
            for (const label of layout.labels) {
                expect(label.withinViewport, JSON.stringify(label)).toBe(true);
                if (label.available !== null) expect(label.measured).toBeLessThanOrEqual(label.available + .001);
                expect(parseFloat(label.fontSize)).toBeGreaterThanOrEqual(10);
                expect(label.text).not.toMatch(/#[A-Z0-9]{3}\b/);
            }
        }
        await expect(page.locator(".table-container button")).toHaveCount(0);
    });
}

test("readable component names and segment totals/shares survive at report size without relying on color", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 620 });
    await mount(page, REPORT_FIXTURE);
    await page.evaluate(() => window.harness.resize(1280, 620));
    await assertAreaOracle(page, REPORT_FIXTURE);
    for (const component of REPORT_FIXTURE.components!) {
        await expect(page.locator(".legend-item").filter({ hasText: String(component) })).toBeVisible();
    }
    const names = await page.locator(".cell-name").allTextContents();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(name => REPORT_FIXTURE.components!.includes(name))).toBe(true);
    const widths = await page.locator(".width-label").allTextContents();
    expect(widths).toHaveLength(4);
    expect(widths.every(text => text.includes("$") && text.includes("%"))).toBe(true);
    const labels = await page.locator(".cell").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label")));
    expect(labels.every(label => label?.includes("Value: $") && label.includes("Overall share:"))).toBe(true);
});

test("compact numbered fallback has an unambiguous colon rather than adjoining decimal points", async ({ page }) => {
    await mount(page, REPORT_FIXTURE);
    await page.evaluate(() => window.harness.resize(398, 298));
    const labels = await page.locator(".cell-label").allTextContents();
    expect(labels.some(text => /^\d+:\s+\d/.test(text))).toBe(true);
    expect(labels.some(text => /^\d+\.\s+\d/.test(text))).toBe(false);
    await assertAreaOracle(page, REPORT_FIXTURE);
});

test("long labels and extremely narrow columns never inflate or leak outside their measured cells", async ({ page }) => {
    const fixture: Fixture = { segments: ["Tiny", "International diversified enterprise customer relationships ".repeat(15)],
        components: ["Long hardware and services component name ".repeat(8), "Software subscriptions"],
        values: [[.0001, .0002], [6000, 4000]], labelContent: "raw" };
    await mount(page, fixture);
    await page.evaluate(() => window.harness.resize(398, 298));
    const plot = await assertAreaOracle(page, fixture);
    expect(plot.cells[0]!.width).toBeGreaterThan(0);
    expect(plot.cells[0]!.width).toBeLessThan(.0001);
    await expect(page.locator(".segment-label")).toHaveCount(0);
    const layout = await readLayout(page);
    for (const label of layout.labels) {
        expect(label.withinViewport).toBe(true);
        if (label.available !== null) expect(label.measured).toBeLessThanOrEqual(label.available + .001);
    }
    await page.getByRole("button", { name: "Data table", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(4);
    await expect(page.locator("tbody tr").first()).toContainText("Tiny");
    await expect(page.locator("tbody tr").last()).toContainText("International diversified");
});

test("missing, partial, loading, stopped, invalid and recovery transitions preserve truthful denominators", async ({ page }) => {
    const partial: Fixture = { ...REPORT_FIXTURE, partial: true, values: [[540, null, 90], [330, 240, 180], [210, 150, 240], [60, 120, 120]] };
    await mount(page, partial, { fetchResult: true });
    await page.evaluate(() => window.harness.resize(398, 298));
    await assertAreaOracle(page, partial);
    await expect(page.locator(".partial")).toBeVisible();
    await expect(page.locator(".blank")).toBeVisible();
    await expect(page.locator(".fetch")).toBeVisible();
    expect((await hostLog(page)).fetch).toEqual([true]);
    await page.evaluate(partial => window.harness.update(partial, 398, 298, true), partial);
    await expect(page.locator(".fetch")).toHaveCount(0);
    await expect(page.locator(".status")).toContainText(/stop|refus|limit/i);
    expect((await hostLog(page)).fetch).toEqual([true]);
    await page.evaluate(() => window.harness.update({ values: [[-10, 5], [20, 40]], showTable: true }));
    await expect(page.locator(".invalid")).toBeVisible();
    await expect(page.locator(".chart")).toHaveCount(0);
    await expect(page.locator("tbody tr").first().locator("td").nth(3)).toHaveText("Not defined");
    await page.evaluate(fixture => window.harness.update(fixture, 398, 298), REPORT_FIXTURE);
    await assertAreaOracle(page, REPORT_FIXTURE);
    await expect(page.locator(".partial, .invalid, .fetch")).toHaveCount(0);
    await page.evaluate(() => window.harness.clearData());
    await expect(page.locator(".binding")).toBeVisible();
    await expect(page.locator(".onboarding")).toBeVisible();
    await expect(page.locator(".chart")).toHaveCount(0);
    await page.evaluate(fixture => window.harness.update(fixture, 398, 298), REPORT_FIXTURE);
    await assertAreaOracle(page, REPORT_FIXTURE);
});

test("large-total precision warning is truthful while representable proportions remain unchanged", async ({ page }) => {
    const fixture: Fixture = { values: [[2 ** 52, 2 ** 52], [2 ** 52, 2 ** 52]], format: "#,0" };
    await mount(page, fixture);
    await expect(page.locator(".status .precision")).toContainText("cannot restore digits already rounded by the host");
    await assertAreaOracle(page, fixture);
    await page.evaluate(() => window.harness.resize(398, 298));
    await expect(page.locator(".status .precision")).toBeVisible();
    await assertAreaOracle(page, fixture);
    await page.evaluate(fixture => window.harness.update(fixture), REPORT_FIXTURE);
    await expect(page.locator(".precision")).toHaveCount(0);
    await assertAreaOracle(page, REPORT_FIXTURE);
});

test("settings and bookmark simulations round-trip data table and label settings without changing area", async ({ page }) => {
    await mount(page, REPORT_FIXTURE);
    await page.getByRole("button", { name: "Data table", exact: true }).click();
    expect((await hostLog(page)).persisted.at(-1)?.merge).toEqual([{
        objectName: "appearance", selector: {}, properties: { showTable: true }
    }]);
    await page.evaluate(fixture => window.harness.update({ ...fixture, showTable: true }, 398, 298), REPORT_FIXTURE);
    await expect(page.locator("tbody tr")).toHaveCount(12);
    await page.evaluate(fixture => window.harness.update({ ...fixture, showTable: false, labelContent: "raw", fontSize: 16 }, 1280, 620), REPORT_FIXTURE);
    await assertAreaOracle(page, REPORT_FIXTURE);
    expect((await page.locator(".cell-label").allTextContents()).some(text => text.includes("$"))).toBe(true);
    await page.evaluate(fixture => window.harness.update({ ...fixture, showLabels: false, direction: "rtl" }), REPORT_FIXTURE);
    await expect(page.locator(".cell-label, .cell-name")).toHaveCount(0);
    await assertAreaOracle(page, REPORT_FIXTURE, true);
    await page.evaluate(fixture => window.harness.update(fixture), REPORT_FIXTURE);
    await assertAreaOracle(page, REPORT_FIXTURE);
    await expect(page.locator(".cell-label").first()).toContainText("%");
    await page.evaluate(() => window.harness.external([{ category: "category-2" }]));
    await expect(page.locator('.cell[data-segment="2"].selected')).toHaveCount(3);
    await page.evaluate(fixture => window.harness.update(fixture), REPORT_FIXTURE);
    await expect(page.locator('.cell[data-segment="2"].selected')).toHaveCount(3);
});

for (const size of [{ width: 180, height: 160 }, { width: 258, height: 198 }]) {
    test(`compact error-state Data table remains usable at ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size);
        await mount(page, { additive: false, values: [[10, null], [null, 5]] });
        await page.evaluate(size => window.harness.resize(size.width, size.height), size);
        await expect(page.locator(".confirm")).toBeVisible();
        await expect(page.locator(".blank")).toBeVisible();
        await page.getByRole("button", { name: "Data table", exact: true }).click();
        await expect(page.locator(".chart")).toHaveCount(0);
        const container = page.locator(".table-container:not(.sr-only)");
        const dimensions = await container.evaluate(node => ({
            clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
            statusHeight: document.querySelector(".status")!.getBoundingClientRect().height,
            pagerHeight: node.querySelector(".pager")!.getBoundingClientRect().height,
            overflow: getComputedStyle(node).overflowY
        }));
        expect(dimensions.clientHeight, JSON.stringify(dimensions)).toBeGreaterThanOrEqual(32);
        expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
        expect(dimensions.overflow).toBe("auto");
        expect(dimensions.statusHeight).toBeLessThanOrEqual(42.5);
        const accessible = await container.evaluate(node => {
            node.scrollTop = node.scrollHeight;
            node.scrollLeft = 0;
            const button = node.querySelector("tbody tr:last-child button")!;
            const bounds = button.getBoundingClientRect();
            const viewport = node.getBoundingClientRect();
            const x = Math.max(bounds.left, viewport.left) + Math.min(bounds.width, viewport.width) / 2;
            const y = (bounds.top + bounds.bottom) / 2;
            const hit = document.elementFromPoint(x, y);
            return { scrollTop: node.scrollTop, buttonExposed: y >= viewport.top && y <= viewport.bottom &&
                !!hit && (hit === button || button.contains(hit)) };
        });
        expect(accessible.scrollTop).toBeGreaterThan(0);
        expect(accessible.buttonExposed, `Scrolling must expose data below the pager: ${JSON.stringify({ dimensions, accessible })}`).toBe(true);
        await expect(page.locator("tbody tr").first().locator("td").nth(3)).toHaveText("Not defined");
    });
}

test("two simultaneous instances isolate SVG resources, selections, callbacks and destroy even with colliding host IDs", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await mount(page, REPORT_FIXTURE, { highContrast: true, instanceId: "shared/host-id" });
    await mount(page, REPORT_FIXTURE, { highContrast: true, instanceId: "shared/host-id" }, "second");
    await page.evaluate(() => {
        document.body.style.display = "flex";
        window.harnesses.visual!.resize(660, 620);
        window.harnesses.second!.resize(660, 620);
    });
    await assertAreaOracle(page, REPORT_FIXTURE, false, "#visual");
    await assertAreaOracle(page, REPORT_FIXTURE, false, "#second");
    const resources = await page.locator("pattern").evaluateAll(nodes => nodes.map(node => node.id));
    expect(new Set(resources).size).toBe(resources.length);
    const fills = await page.locator(".cell").evaluateAll(nodes => nodes.map(node => node.getAttribute("fill")));
    for (const fill of fills) expect(resources).toContain(fill!.slice(5, -1));
    await page.locator("#visual .cell").first().click();
    await expect(page.locator("#visual .cell.selected")).toHaveCount(1);
    await expect(page.locator("#second .cell.selected")).toHaveCount(0);
    await page.evaluate(() => window.harnesses.second!.external([{ series: "series-1" }]));
    await expect(page.locator("#second .cell.selected")).toHaveCount(4);
    await expect(page.locator("#visual .cell.selected")).toHaveCount(1);
    await page.evaluate(() => {
        window.harnesses.visual!.visual.destroy?.();
        window.harnesses.visual!.external([{ category: "category-0" }]);
        window.harnesses.visual!.resize(300, 200);
    });
    await expect(page.locator("#visual .atlyn-marimekko")).toHaveCount(0);
    await assertAreaOracle(page, REPORT_FIXTURE, false, "#second");
    await page.locator("#second .cell").first().click();
    await expect(page.locator("#second .cell.selected")).toHaveCount(1);
});

test("rejected interactions recover, and pending callbacks cannot resurrect a destroyed visual", async ({ page }) => {
    await mount(page, REPORT_FIXTURE, { rejectInteractions: true });
    await page.locator(".cell").first().click();
    await expect(page.locator(".interaction-error")).toBeVisible();
    await expect(page.locator(".cell.selected")).toHaveCount(0);
    await page.evaluate(() => window.harness.setHostOptions({ rejectInteractions: false }));
    await page.locator(".cell").first().click();
    await expect(page.locator(".interaction-error")).toHaveCount(0);
    await expect(page.locator(".cell.selected")).toHaveCount(1);
    await page.evaluate(() => window.harness.setHostOptions({ rejectInteractions: true }));
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await expect(page.locator(".interaction-error")).toBeVisible();
    await page.evaluate(() => window.harness.setHostOptions({ rejectInteractions: false }));
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await expect(page.locator(".interaction-error")).toHaveCount(0);
    await expect(page.locator(".cell.selected")).toHaveCount(0);
    await page.evaluate(() => {
        document.querySelector(".cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        window.harness.visual.destroy?.();
        window.harness.external([{ category: "category-0" }]);
    });
    await page.evaluate(() => Promise.resolve());
    await expect(page.locator(".atlyn-marimekko")).toHaveCount(0);
    expect((await hostLog(page)).tooltip.at(-1)).toMatchObject({ kind: "hide", immediately: true });
});

test("high contrast and automatic RTL keep native keyboard focus, tooltip text and reduced-motion behavior", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mount(page, REPORT_FIXTURE, { highContrast: true, locale: "ar-SA" });
    await page.evaluate(() => window.harness.resize(1280, 620));
    await expect(page.locator(".atlyn-marimekko")).toHaveAttribute("dir", "rtl");
    await assertAreaOracle(page, REPORT_FIXTURE, true);
    await page.keyboard.press("Tab");
    await page.locator('.cell[data-segment="0"][data-component="0"]').focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator('.cell[data-segment="1"][data-component="0"]')).toBeFocused();
    const focused = page.locator(".cell:focus");
    expect(await focused.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThan(0);
    expect((await hostLog(page)).tooltip.some(event => event.kind === "show" && event.dataItems?.some(item => item.value === "Europe"))).toBe(true);
    await page.keyboard.press("Enter");
    await expect(focused).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator(".cell.selected")).toHaveCount(0);
    const animations = await page.locator(".atlyn-marimekko, .cell").evaluateAll(nodes =>
        nodes.map(node => ({ animation: getComputedStyle(node).animationDuration, transition: getComputedStyle(node).transitionDuration })));
    expect(animations.every(item => parseFloat(item.animation) === 0 && parseFloat(item.transition) === 0)).toBe(true);
    await expect(page.locator(".atlyn-marimekko")).toHaveCSS("color", "rgb(255, 255, 0)");
});

test.describe("actual Chromium touch input", () => {
    test.use({ hasTouch: true });
    test("tap selects native identity and touch tooltip dismissal preserves touch modality", async ({ page }) => {
        await mount(page, REPORT_FIXTURE);
        await page.locator(".cell").first().tap();
        await expect(page.locator(".cell.selected")).toHaveCount(1);
        expect((await hostLog(page)).tooltip.some(item => item.kind === "show" && item.isTouchEvent)).toBe(true);
        expect((await hostLog(page)).tooltip.some(item => item.kind === "hide" && item.isTouchEvent)).toBe(true);
        await page.getByRole("button", { name: "Clear selection", exact: true }).tap();
        await expect(page.locator(".cell.selected")).toHaveCount(0);
    });
});

for (const [segments, components] of [[200, 20], [100, 40]]) {
    test(`independent area and continuity oracle covers ${segments}x${components} maximum cells`, async ({ page }) => {
        test.setTimeout(120_000);
        const fixture = seededFixture(segments!, components!);
        await mount(page, fixture);
        await page.evaluate(() => window.harness.resize(1280, 620));
        await assertAreaOracle(page, fixture);
        await expect(page.locator(".cell[tabindex='0']")).toHaveCount(1);
        await expect(page.locator(".limit")).toHaveCount(0);
    });
}
