import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { hostLog, mount, type Fixture } from "./host";
import { assertAreaOracle, plotGeometry } from "./oracles";

const cell = (page: Page, segment: number, component: number) =>
    page.locator(`.chart .cell[data-segment="${segment}"][data-component="${component}"]`);

async function geometry(page: Page) {
    return (await plotGeometry(page))!.cells;
}

test.afterEach(async ({ page }) => {
    if (await page.evaluate(() => !!window.harness)) expect((await hostLog(page)).failures).toEqual([]);
});

test("packaged PBIVIZ has exact area geometry, local styling and no network requests", async ({ page }) => {
    const requests = await mount(page);
    await expect(page.locator(".chart")).toBeVisible();
    await assertAreaOracle(page, {});
    await expect(page.locator(".total")).toHaveText("Displayed total: 100.00");
    await expect(page.locator(".atlyn-marimekko")).toHaveCSS("padding-left", "12px");
    await expect(page.locator(".atlyn-marimekko")).toHaveCSS("font-size", "12px");
    await expect(page.locator(".table-container")).toHaveClass(/sr-only/);
    await expect(page.locator(".table-container button")).toHaveCount(0);
    expect((await hostLog(page)).events).toEqual(["started", "finished"]);
    expect((await hostLog(page)).localization).toEqual(["Role_Segment", "Role_Component"]);
    await page.screenshot({ path: resolve(".tmp", "browser", "marimekko.png") });
    expect(requests).toEqual([]);
});

test("subpixel columns retain their proportional width; actual SVG measurement removes long labels", async ({ page }) => {
    await mount(page, { segments: ["Tiny", "An exceptionally long category label ".repeat(18)],
        values: [[.01, 0], [999.99, 0]], labelContent: "raw" });
    const cells = await geometry(page);
    expect(cells).toHaveLength(2);
    expect(cells[0]!.width).toBeGreaterThan(0);
    expect(cells[0]!.width).toBeLessThan(.01);
    expect(cells[0]!.width).toBeCloseTo(.00001 * (await plotGeometry(page))!.width, 8);
    expect(cells[0]!.share).toBeCloseTo(.00001, 12);
    await expect(page.locator(".segment-label")).toHaveCount(0);
    const measurements = await page.locator(".chart text").evaluateAll(nodes => nodes.map(node => ({
        measured: (node as SVGTextElement).getComputedTextLength(),
        available: Number(node.getAttribute("data-max-width"))
    })));
    expect(measurements.length).toBeGreaterThan(0);
    for (const measurement of measurements) {
        expect(measurement.measured).toBeGreaterThan(0);
        expect(measurement.measured).toBeLessThanOrEqual(measurement.available);
    }
});

test("sparse cells and zero-width segments survive in the equivalent table without invented area", async ({ page }) => {
    await mount(page, { segments: ["Positive", "Missing", "Zero"], values: [[10, null], [null, null], [0, 0]], showTable: true });
    await expect(page.locator(".chart .cell")).toHaveCount(1);
    expect((await geometry(page))[0]!.width).toBe((await plotGeometry(page))!.width);
    await expect(page.locator("tbody tr")).toHaveCount(6);
    await expect(page.locator("tbody tr").nth(1).locator("td").nth(2)).toHaveText("(Missing)");
    await expect(page.locator("tbody tr").nth(4).locator("td").nth(2)).toHaveText("0.00");
    await expect(page.locator("tbody tr").nth(4).locator("td").nth(5)).toHaveText("Not defined");
    await expect(page.locator(".diagnostic.blank")).toContainText("not observed zeroes");
});

for (const scenario of [
    { name: "all-zero", input: { values: [[0, 0], [0, 0]] }, diagnostic: "zero" },
    { name: "all-missing", input: { values: [[null, null], [null, null]] }, diagnostic: "empty" },
    { name: "empty", input: { segments: [], values: [] }, diagnostic: "empty" },
    { name: "negative", input: { values: [[-1, 10], [20, 40]] }, diagnostic: "invalid" },
    { name: "nonnumeric", input: { values: [["oops", 10], [20, 40]] }, diagnostic: "invalid" },
    { name: "nonfinite", input: { values: [[Infinity, 10], [20, 40]] }, diagnostic: "invalid" },
    { name: "unconfirmed additive measure", input: { additive: false }, diagnostic: "confirm" },
    { name: "percentage measure", input: { format: "0.0%" }, diagnostic: "ratio" },
    { name: "dynamic percentage format", input: { dynamicFormat: "0.0%" }, diagnostic: "ratio" },
    { name: "missing category identity", input: { noCategoryIdentity: true }, diagnostic: "identity" },
    { name: "missing series identity", input: { noSeriesIdentity: true }, diagnostic: "identity" },
    { name: "duplicate category identity", input: { duplicateCategoryIdentity: true }, diagnostic: "identity" },
    { name: "invalid role binding", input: { invalidBinding: true }, diagnostic: "binding" }
] satisfies { name: string; input: Fixture; diagnostic: string }[]) {
    test(`${scenario.name} gives an accessible truthful diagnostic rather than geometry`, async ({ page }) => {
        await mount(page, { ...scenario.input, showTable: true });
        await expect(page.locator(".chart")).toHaveCount(0);
        await expect(page.locator(`.status .${scenario.diagnostic}`)).toBeVisible();
        await expect(page.locator(".status")).toHaveAttribute("aria-live", "polite");
        if (scenario.diagnostic === "identity") {
            await expect(page.locator("tbody button:not(:disabled)")).toHaveCount(0);
        }
    });
}

test("resize recalculates dimensions without changing denominators; empty Data update clears stale geometry", async ({ page }) => {
    await mount(page);
    await page.evaluate(() => window.harness.resize(480, 420));
    const cells = await geometry(page);
    await assertAreaOracle(page, {});
    expect(cells.map(rect => rect.share)).toEqual([.3, .1, .2, .4]);
    expect((await hostLog(page)).events).toEqual(["started", "finished", "started", "finished"]);
    await page.evaluate(() => window.harness.clearData());
    await expect(page.locator(".chart")).toHaveCount(0);
    await expect(page.locator(".binding")).toBeVisible();
});

test("partial data uses subset labels and aggregate fetching, never refetches on resize, then completes", async ({ page }) => {
    await mount(page, { partial: true, showTable: true }, { fetchResult: true });
    await expect(page.locator(".denominator")).toContainText("NOT the full filter-context total");
    await expect(page.locator(".fetch")).toContainText("Loading more data");
    await expect(page.locator("thead th").nth(6)).toHaveText("Displayed-subset share");
    await cell(page, 0, 0).hover();
    const tooltip = (await hostLog(page)).tooltip.filter(item => item.kind === "show").at(-1)!;
    expect(tooltip.dataItems).toContainEqual({ displayName: "Displayed-subset share", value: "30.0%" });
    expect(tooltip.dataItems!.some(item => item.displayName === "Overall share")).toBe(false);
    expect((await hostLog(page)).fetch).toEqual([true]);
    await page.evaluate(() => window.harness.resize(850, 600));
    expect((await hostLog(page)).fetch).toEqual([true]);
    await page.evaluate(() => window.harness.update({ segments: ["Enterprise", "Consumer", "Public"],
        values: [[30, 10], [20, 40], [10, 90]], showTable: true }, 850, 600, true));
    await expect(page.locator(".partial, .denominator, .fetch")).toHaveCount(0);
    await expect(page.locator(".total")).toHaveText("Displayed total: 200.00");
    expect((await geometry(page))[0]!.share).toBe(.15);
    expect((await hostLog(page)).fetch).toEqual([true]);
});

test("fetch refusal and no-progress stop cleanly with honest subset status", async ({ page }) => {
    await mount(page, { partial: true }, { fetchResult: false });
    await expect(page.locator(".status")).toContainText("fetching was refused");
    expect((await hostLog(page)).fetch).toEqual([true]);
    await page.evaluate(() => window.harness.update({ partial: true }, 900, 650, true));
    expect((await hostLog(page)).fetch).toEqual([true]);
    await expect(page.locator(".partial")).toBeVisible();
    await expect(page.locator(".fetch")).toHaveCount(0);
});

test("fetch requests stop at eight and display row limits do not request more", async ({ page }) => {
    await mount(page, { partial: true }, { fetchResult: true });
    await page.evaluate(() => {
        for (let count = 3; count <= 10; count++) window.harness.update({
            partial: true, segments: Array.from({ length: count }, (_, i) => `S${i}`),
            values: Array.from({ length: count }, () => [1, 1])
        }, 900, 650, true);
    });
    expect((await hostLog(page)).fetch).toEqual(Array(8).fill(true));
    await expect(page.locator(".status")).toContainText("request limit");
    await page.evaluate(() => window.harness.update({
        partial: true, segments: Array.from({ length: 201 }, (_, i) => `S${i}`),
        values: Array.from({ length: 201 }, () => [1, 1]), showTable: true
    }));
    expect((await hostLog(page)).fetch).toHaveLength(8);
    await expect(page.locator(".limit")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(100);
    await expect(page.locator(".pager")).toContainText("Page 1 / 4");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".pager")).toContainText("Page 2 / 4");
});

test("highlights overlay original totals and null highlights dim instead of renormalizing", async ({ page }) => {
    await mount(page, { highlights: [[15, null], [null, 10]], showTable: true });
    const base = await geometry(page);
    const plotHeight = (await plotGeometry(page))!.height;
    expect(base.map(rect => rect.share)).toEqual([.3, .1, .2, .4]);
    const overlays = await page.locator(".highlight-overlay").evaluateAll(nodes => nodes.map(node => ({
        height: Number(node.getAttribute("height")), y: Number(node.getAttribute("y")), width: Number(node.getAttribute("width"))
    })));
    expect(overlays).toHaveLength(2);
    expect(overlays[0]!.height).toBeCloseTo(15 / 40 * plotHeight, 10);
    expect(overlays[1]!.height).toBeCloseTo(10 / 60 * plotHeight, 10);
    expect(overlays[0]!.y + overlays[0]!.height).toBeCloseTo(plotHeight, 10);
    await expect(cell(page, 0, 1)).toHaveCSS("opacity", "0.25");
    await expect(page.locator(".highlight-overlay").first()).toHaveCSS("pointer-events", "none");
    await cell(page, 0, 0).hover();
    const tooltip = (await hostLog(page)).tooltip.filter(item => item.kind === "show").at(-1)!;
    expect(tooltip.dataItems).toContainEqual({ displayName: "Highlighted value", value: "15.00" });
    expect(tooltip.dataItems).toContainEqual({ displayName: "Highlight / segment total", value: "37.5%" });
    await page.evaluate(() => window.harness.update({ highlights: [[31, null], [null, 10]] }));
    await expect(page.locator(".highlight-overlay, .highlight-base")).toHaveCount(0);
    await expect(page.locator(".highlight")).toBeVisible();
    expect((await geometry(page)).map(rect => rect.share)).toEqual([.3, .1, .2, .4]);
});

test("native cell, category and component selections support ctrl, keyboard, callback and Escape", async ({ page }) => {
    await mount(page, { showTable: true });
    await cell(page, 0, 0).click();
    await expect(cell(page, 0, 0)).toHaveAttribute("aria-pressed", "true");
    await expect(cell(page, 1, 1)).toHaveClass(/muted/);
    const firstKey = (await hostLog(page)).select[0]!.key;
    expect(JSON.parse(firstKey)).toEqual([["category", "category-0"], ["measure", "Facts.Revenue"], ["series", "series-0"]]);
    await cell(page, 1, 1).click({ modifiers: ["Control"] });
    expect((await hostLog(page)).select.at(-1)!.multiple).toBe(true);
    await expect(cell(page, 0, 0)).toHaveAttribute("aria-pressed", "true");
    await expect(cell(page, 1, 1)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator(".cell.selected")).toHaveCount(0);
    expect((await hostLog(page)).clear).toBe(1);
    await page.locator(".segment-label").first().click();
    expect(JSON.parse((await hostLog(page)).select.at(-1)!.key)).toEqual([["category", "category-0"]]);
    await expect(page.locator('.cell[data-segment="0"].selected')).toHaveCount(2);
    await page.locator(".legend-item").nth(1).click();
    expect(JSON.parse((await hostLog(page)).select.at(-1)!.key)).toEqual([["series", "series-1"]]);
    await expect(page.locator('.cell[data-component="1"].selected')).toHaveCount(2);
    await cell(page, 0, 0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(cell(page, 1, 0)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(cell(page, 1, 1)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(cell(page, 0, 0)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(cell(page, 0, 0)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("End");
    await page.keyboard.press("Control+Space");
    await expect(cell(page, 1, 1)).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => window.harness.external([{ category: "category-1" }]));
    await expect(page.locator('.cell[data-segment="1"].selected')).toHaveCount(2);
    await expect(page.locator('.cell[data-segment="0"].muted')).toHaveCount(2);
    await page.evaluate(() => window.harness.resize(850, 650));
    await expect(page.locator('.cell[data-segment="1"].selected')).toHaveCount(2);
    await expect(page.locator('.cell[tabindex="0"]')).toHaveCount(1);
    await page.evaluate(() => window.harness.external([]));
    await expect(page.locator(".cell.muted, .cell.selected")).toHaveCount(0);
});

test("tooltip uses native identity and model raw format; right click and keyboard invoke host context menus", async ({ page }) => {
    await mount(page, { dynamicFormat: "$#,0.00", showTable: true });
    await cell(page, 0, 0).hover();
    const shown = (await hostLog(page)).tooltip.filter(event => event.kind === "show").at(-1)!;
    expect(shown.keys).toHaveLength(1);
    expect(JSON.parse(shown.keys![0]!)).toEqual([["category", "category-0"], ["measure", "Facts.Revenue"], ["series", "series-0"]]);
    expect(shown.dataItems).toContainEqual({ displayName: "Value", value: "$30.00" });
    expect(shown.dataItems).toContainEqual({ displayName: "Segment total", value: "$40.00" });
    expect(shown.dataItems).toContainEqual({ displayName: "Overall share", value: "30.0%" });
    expect(shown.coordinates!.every(Number.isFinite)).toBe(true);
    await page.mouse.move(1000, 800);
    expect((await hostLog(page)).tooltip.at(-1)).toMatchObject({ kind: "hide", immediately: false });
    await cell(page, 0, 0).click({ button: "right" });
    expect((await hostLog(page)).context).toHaveLength(1);
    await cell(page, 1, 1).focus();
    await page.keyboard.press("Shift+F10");
    expect((await hostLog(page)).context).toHaveLength(2);
    await page.keyboard.press("ContextMenu");
    const menus = (await hostLog(page)).context;
    expect(menus).toHaveLength(3);
    expect(menus[0]!.key).toBe(shown.keys![0]);
    expect(menus[1]!.key).toBe(menus[2]!.key);
    for (const menu of menus) { expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.y).toBeGreaterThan(0); }
    await page.locator(".chart-background").evaluate(node => node.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 19, clientY: 23 })
    ));
    expect((await hostLog(page)).context.at(-1)).toEqual({ key: "[]", x: 19, y: 23 });
    await page.locator(".chart-background").dispatchEvent("click");
    expect((await hostLog(page)).clear).toBe(1);
});

test("right-click on empty visual space across genuine canvas blank regions opens basic context menu", async ({ page }) => {
    await mount(page, { dynamicFormat: "$#,0.00" });
    const log = () => hostLog(page);
    const triggerContext = (selector: string, clientX: number, clientY: number) =>
        page.locator(selector).first().evaluate((node, coords) => node.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: coords.x, clientY: coords.y })
        ), { x: clientX, y: clientY });

    // 1. Right-click root container padding / margin
    await triggerContext(".atlyn-marimekko", 5, 5);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 5, y: 5 });

    // 2. Right-click header area
    await triggerContext(".header", 50, 15);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 50, y: 15 });

    // 3. Right-click legend caption / whitespace
    await triggerContext(".legend-caption", 80, 35);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 80, y: 35 });

    // 4. Right-click plot container whitespace
    await triggerContext(".plot-container", 200, 200);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 200, y: 200 });

    // 5. Right-click chart SVG footer area (below bars)
    await triggerContext(".chart", 150, 630);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 150, y: 630 });

    // 6. Right-click width label in footer
    await triggerContext(".width-label", 100, 620);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 100, y: 620 });

    // 7. Right-click during onboarding / unmapped / landing state
    await page.evaluate(() => window.harness.clearData());
    await expect(page.locator(".onboarding")).toBeVisible();
    await triggerContext(".onboarding", 300, 250);
    expect((await log()).context.at(-1)).toEqual({ key: "[]", x: 300, y: 250 });

    // 8. Keyboard Shift+F10 on root triggers empty-space context menu
    await page.locator(".atlyn-marimekko").press("Shift+F10");
    const last = (await log()).context.at(-1)!;
    expect(last.key).toBe("[]");
    expect(last.x).toBeGreaterThanOrEqual(0);
    expect(last.y).toBeGreaterThanOrEqual(0);
});

test("high contrast has distinguishable patterns and an equivalent, operable data table", async ({ page }) => {
    await mount(page, { showTable: true }, { highContrast: true });
    await expect(page.locator(".atlyn-marimekko")).toHaveClass(/high-contrast/);
    await expect(page.locator(".atlyn-marimekko")).toHaveCSS("color", "rgb(255, 255, 0)");
    await expect(page.locator(".atlyn-marimekko")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    const patterns = await page.locator("pattern").evaluateAll(nodes => nodes.map(node => ({
        id: node.id, width: node.getAttribute("width"), rotation: node.getAttribute("patternTransform")
    })));
    expect(patterns).toHaveLength(2);
    expect(new Set(patterns.map(pattern => `${pattern.width}/${pattern.rotation}`)).size).toBe(2);
    expect(patterns.every(pattern => /^atlyn-browserpackaged-instanceone-[\d-]+$/.test(pattern.id))).toBe(true);
    for (let component = 0; component < 2; component++) {
        await expect(cell(page, 0, component)).toHaveAttribute("fill", `url(#${patterns[component]!.id})`);
    }
    await expect(page.locator("thead th")).toHaveCount(8);
    await expect(page.locator("tbody tr")).toHaveCount(4);
    const row = page.locator("tbody tr").first().locator("td");
    await expect(row.nth(1)).toContainText("Services");
    expect((await row.allTextContents()).filter((_, i) => i !== 1)).toEqual([
        "Enterprise", "30.00", "40.00", "40.0%", "75.0%", "30.0%", "Not defined"
    ]);
    await page.locator("tbody tr").first().locator("button").nth(2).click();
    await expect(cell(page, 0, 0)).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Hide data table", exact: true }).click();
    await expect(page.locator(".table-container button")).toHaveCount(0);
});

test("French and RTL preserve localized numbers, labels and correct mirrored geometry", async ({ page }) => {
    await mount(page, { segments: [1.5, 2.5], categoryFormat: "0.0", values: [[1234.5, 10], [20, 40]],
        showTable: true, direction: "rtl" }, { locale: "fr-FR" });
    await expect(page.getByRole("button", { name: "Effacer la selection" })).toBeVisible();
    await expect(page.locator(".atlyn-marimekko")).toHaveAttribute("dir", "rtl");
    await expect(page.locator(".encoding")).toContainText("Largeur = part du segment");
    await expect(page.locator("tbody tr").first().locator("td").nth(0)).toHaveText("1,5");
    await expect(page.locator("tbody tr").first().locator("td").nth(2)).toHaveText(/1[\s\u00a0\u202f]234,50/);
    const rects = await geometry(page);
    expect(rects[0]!.x).toBeCloseTo(60 / 1304.5 * (await plotGeometry(page))!.width, 8);
    expect(rects[2]!.x).toBeCloseTo(0, 4);
    await cell(page, 0, 0).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(cell(page, 1, 0)).toBeFocused();
    await page.evaluate(() => window.harness.update({ direction: "ltr" }));
    await expect(page.locator(".atlyn-marimekko")).toHaveAttribute("dir", "ltr");
});

test("small viewports retain a usable data table and disabled interactions do not call the host", async ({ page }) => {
    await mount(page, { showTable: true }, { allowInteractions: false });
    await expect(page.locator(".cell[tabindex='0']")).toHaveCount(0);
    await expect(cell(page, 0, 0)).toHaveAttribute("aria-disabled", "true");
    await cell(page, 0, 0).click({ force: true });
    await cell(page, 0, 0).dispatchEvent("keydown", { key: "Enter" });
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    expect((await hostLog(page)).select).toEqual([]);
    expect((await hostLog(page)).clear).toBe(0);
    await page.evaluate(() => window.harness.resize(160, 160));
    await expect(page.locator(".chart")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hide data table", exact: true })).toBeVisible();
    await expect(page.locator("table")).toBeAttached();
    await expect(page.locator("tbody tr")).toHaveCount(4);
});

test("host promise rejection is surfaced and destroy makes callbacks and updates harmless", async ({ page }) => {
    const requests = await mount(page, {}, { rejectInteractions: true });
    await cell(page, 0, 0).click();
    await expect(page.locator(".status")).toContainText("host rejected the interaction");
    const before = (await hostLog(page)).events.length;
    await page.evaluate(() => {
        window.harness.visual.destroy?.();
        window.harness.external([{ category: "category-0" }]);
        window.harness.resize(500, 300);
        window.harness.update();
    });
    await expect(page.locator(".atlyn-marimekko")).toHaveCount(0);
    expect((await hostLog(page)).events).toHaveLength(before);
    expect((await hostLog(page)).tooltip.at(-1)).toMatchObject({ kind: "hide", immediately: true });
    expect(requests).toEqual([]);
});
