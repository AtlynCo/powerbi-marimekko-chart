import { expect, type Page } from "@playwright/test";
import type { Fixture } from "./host";
import assert from "node:assert/strict";

export const REQUESTED_VIEWPORTS = [
    { width: 80, height: 80 }, { width: 258, height: 198 }, { width: 398, height: 298 },
    { width: 1280, height: 620 }, { width: 1366, height: 768 }
];
export const REPORT_FIXTURE: Fixture = {
    segments: ["North America", "Europe", "Asia Pacific", "Latin America"],
    components: ["Software", "Services", "Hardware"],
    values: [[540, 270, 90], [330, 240, 180], [210, 150, 240], [60, 120, 120]],
    format: "$#,0", additive: true
};
export const FIXTURE_SEED = 0x41544c59;
export function seededFixture(segments: number, components: number): Fixture {
    let state = FIXTURE_SEED;
    return {
        segments: Array.from({ length: segments }, (_, i) => `Region ${i + 1}`),
        components: Array.from({ length: components }, (_, i) => `Product ${i + 1}`),
        values: Array.from({ length: segments }, () => Array.from({ length: components }, () => {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            return 1 + state % 1000;
        })),
        additive: true, showTable: false, showLabels: true, format: "#,0"
    };
}

export async function plotGeometry(page: Page, root = "#visual") {
    return page.locator(root).evaluate(container => {
        const chart = container.querySelector<SVGSVGElement>(".chart");
        const background = chart?.querySelector<SVGRectElement>(".chart-background");
        if (!chart || !background) return null;
        const numeric = (node: Element, attribute: string) => Number(node.getAttribute(attribute) ?? 0);
        return {
            width: numeric(background, "width"), height: numeric(background, "height"),
            x: numeric(background, "x"), y: numeric(background, "y"),
            cells: Array.from(chart.querySelectorAll<SVGRectElement>(".cell")).map(rect => ({
                segment: Number(rect.dataset.segment), component: Number(rect.dataset.component),
                x: numeric(rect, "x"), y: numeric(rect, "y"), width: numeric(rect, "width"), height: numeric(rect, "height"),
                share: Number(rect.dataset.share), value: Number(rect.dataset.value),
                screenWidth: rect.getBoundingClientRect().width, screenHeight: rect.getBoundingClientRect().height
            }))
        };
    });
}

// The oracle uses fixture arithmetic and the actual SVG plot bounds, never the visual's model or layout code.
export async function assertAreaOracle(page: Page, fixture: Fixture, rtl = false, root = "#visual") {
    const plot = await plotGeometry(page, root);
    expect(plot, "Positive data at this size should produce geometry").not.toBeNull();
    const { width, height, x, y, cells } = plot!;
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    const matrix = fixture.values ?? [[30, 10], [20, 40]];
    const sums = matrix.map(row => row.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0));
    const total = sums.reduce((sum, value) => sum + value, 0);
    expect(cells).toHaveLength(matrix.flat().filter(value => typeof value === "number" && value > 0).length);
    const close = (actual: number, expected: number, tolerance: number, label: string) =>
        assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
            `${label}: actual ${actual}, expected ${expected}, tolerance ${tolerance}`);
    let before = 0;
    for (const [segment, row] of matrix.entries()) {
        const segmentTotal = sums[segment]!;
        const group = cells.filter(rect => rect.segment === segment);
        if (!segmentTotal) { assert.equal(group.length, 0); continue; }
        let below = 0;
        for (const [component, value] of row.entries()) {
            if (typeof value !== "number" || value === 0) continue;
            const rect = group.find(item => item.component === component);
            assert.ok(rect, `Missing positive cell ${segment}/${component}`);
            const start = rtl ? (total - before - segmentTotal) / total : before / total;
            const label = `${segment}/${component}`;
            close((rect.x - x) / width, start, 5e-12, `${label} column start`);
            close(rect.width / width, segmentTotal / total, 5e-12, `${label} width fraction`);
            close(rect.height / height, value / segmentTotal, 5e-12, `${label} height fraction`);
            close((rect.y - y) / height, 1 - (below + value) / segmentTotal, 5e-12, `${label} stack start`);
            close(rect.width * rect.height / (width * height), value / total, 5e-12, `${label} area fraction`);
            close(rect.share, value / total, 5e-12, `${label} share attribute`);
            close(rect.screenWidth, rect.width, 5e-4, `${label} screen width`);
            close(rect.screenHeight, rect.height, 5e-4, `${label} screen height`);
            below += value;
        }
        const byY = [...group].sort((a, b) => a.y - b.y);
        close(byY[0]!.y, y, 5e-9, `segment ${segment} top`);
        for (let i = 1; i < byY.length; i++) close(byY[i]!.y, byY[i - 1]!.y + byY[i - 1]!.height, 5e-9, `segment ${segment} continuity`);
        close(byY.at(-1)!.y + byY.at(-1)!.height, y + height, 5e-9, `segment ${segment} bottom`);
        before += segmentTotal;
    }
    const columns = cells.filter((rect, index) => cells.findIndex(other => other.segment === rect.segment) === index)
        .sort((a, b) => a.x - b.x);
    close(columns[0]!.x, x, 5e-9, "First column start");
    for (let i = 1; i < columns.length; i++) close(columns[i]!.x, columns[i - 1]!.x + columns[i - 1]!.width, 5e-9, `column ${i} continuity`);
    close(columns.at(-1)!.x + columns.at(-1)!.width, x + width, 5e-9, "Last column end");
    return plot!;
}

export async function readLayout(page: Page, root = "#visual") {
    return page.locator(`${root} .atlyn-marimekko`).evaluate(container => {
        const box = container.getBoundingClientRect();
        const visible = (rect: DOMRect) => ({
            withinViewport: rect.left >= box.left - .5 && rect.right <= box.right + .5 &&
                rect.top >= box.top - .5 && rect.bottom <= box.bottom + .5,
            x: rect.x, y: rect.y, width: rect.width, height: rect.height
        });
        return {
            viewport: { width: box.width, height: box.height }, scrollWidth: container.scrollWidth,
            scrollHeight: container.scrollHeight, clientWidth: container.clientWidth, clientHeight: container.clientHeight,
            text: container.textContent,
            labels: Array.from(container.querySelectorAll<SVGTextElement>(".chart text")).map(node => ({
                className: node.getAttribute("class"), text: node.textContent, measured: node.getComputedTextLength(),
                available: node.hasAttribute("data-max-width") ? Number(node.getAttribute("data-max-width")) : null,
                fontSize: getComputedStyle(node).fontSize, fill: getComputedStyle(node).fill,
                stroke: getComputedStyle(node).stroke, ...visible(node.getBoundingClientRect())
            })),
            controls: Array.from(container.querySelectorAll<HTMLElement>(".header button")).filter(node => !node.hidden)
                .map(node => ({ text: node.textContent, name: node.getAttribute("aria-label"),
                    fontSize: getComputedStyle(node).fontSize, ...visible(node.getBoundingClientRect()) })),
            chart: container.querySelector(".chart") ? visible(container.querySelector(".chart")!.getBoundingClientRect()) : null
        };
    });
}
