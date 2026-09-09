import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModel } from "../src/model";
import { makeModelInput, makeDataHost, makeDataView } from "./fixtures";
import { convert } from "../src/data";

// Integer arithmetic is independent of the visual's floating-point totals and cumulative layout.
function rational(numerator: bigint, denominator: bigint): number {
    const scale = 1n << 96n;
    return Number(numerator * scale / denominator) / Number(scale);
}
function close(actual: number, expected: number): void {
    assert.ok(Math.abs(actual - expected) <= 4e-14, `${actual} != rational oracle ${expected}`);
}

test("integer-rational oracle checks 100 seeded grids, shared edges, area and zero positions", () => {
    let seed = 0x4d454b4b;
    const next = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
    };
    for (let trial = 0; trial < 100; trial++) {
        const rows = trial % 17 + 1;
        const columns = trial % 19 + 1;
        const integers = Array.from({ length: rows }, () => Array.from({ length: columns }, () =>
            next() % 7 === 0 ? 0n : BigInt(next()) * 10007n + 1n));
        integers[0]![0] = 1234567n;
        const input = makeModelInput(integers.map(row => row.map(Number)));
        const model = buildModel(input);
        assert.equal(model.drawable, true);
        const totals = integers.map(row => row.reduce((a, b) => a + b, 0n));
        const total = totals.reduce((a, b) => a + b, 0n);
        let before = 0n;
        for (const [j, segment] of model.segments.entries()) {
            close(segment.x, rational(before, total));
            close(segment.width, rational(totals[j]!, total));
            assert.equal(segment.identity, input.segments[j]!.identity);
            let below = 0n;
            for (const [i, cell] of segment.cells.entries()) {
                const value = integers[j]![i]!;
                close(cell.overallShare!, rational(value, total));
                close(segment.width * cell.height, rational(value, total));
                if (totals[j]! > 0n) {
                    close(cell.segmentShare!, rational(value, totals[j]!));
                    close(cell.y, rational(totals[j]! - below - value, totals[j]!));
                }
                if (value === 0n) assert.equal(cell.height, 0);
                if (i) close(cell.y + cell.height, segment.cells[i - 1]!.y);
                assert.equal(cell.identity, input.segments[j]!.cells[i]!.identity);
                below += value;
            }
            if (totals[j]! > 0n) {
                const first = segment.cells[0]!;
                assert.equal(first.y + first.height, 1);
                assert.equal(segment.cells.at(-1)!.y, 0);
            } else assert.equal(segment.width, 0);
            if (j) close(model.segments[j - 1]!.x + model.segments[j - 1]!.width, segment.x);
            before += totals[j]!;
        }
        assert.equal(model.segments.at(-1)!.x + model.segments.at(-1)!.width, 1);
    }
});

test("tiny but representable contributions never receive a minimum width", () => {
    for (const scale of [1e-120, 1, 1e120]) {
        const model = buildModel(makeModelInput([[scale, scale], [scale * 1e-8, 0], [0, 0]]));
        assert.equal(model.drawable, true);
        close(model.segments[1]!.width, 1e-8 / (2 + 1e-8));
        assert.ok(model.segments[1]!.width < 1e-8);
        assert.equal(model.segments[2]!.width, 0);
    }
});

test("unsupported numerical dynamic range is diagnosed in either stacking order", () => {
    for (const values of [[[1e-30, 1]], [[1, 1e-30]], [[1e308, 1e308]], [[Number.MAX_VALUE], [Number.MAX_VALUE]]]) {
        const model = buildModel(makeModelInput(values));
        assert.equal(model.drawable, false);
        assert.ok(model.diagnostics.some(diagnostic => diagnostic.code === "range"));
        assert.ok(model.segments.every(segment => segment.width === 0 && segment.cells.every(cell => cell.height === 0)));
    }
});

test("observations are not merged, rounded, or reclassified by a low or partial denominator", () => {
    const input = makeModelInput([[null, 0, 1], [2, 3, 4]], { partial: true, hasHighlights: true });
    input.segments[1]!.cells[2]!.highlight = 1;
    const result = buildModel(input);
    assert.equal(result.total, 10);
    assert.equal(result.partial, true);
    assert.equal(result.segments[0]!.cells[0]!.overallShare, null);
    assert.equal(result.segments[0]!.cells[1]!.overallShare, 0);
    assert.equal(result.segments[1]!.cells[2]!.overallShare, .4);
    assert.equal(result.segments[1]!.cells[2]!.highlight, 1);
    assert.equal(result.components[2]!.identity, input.components[2]!.identity);
});

test("20,000 host input rows and 16-digit values are bounded honestly, without fabricating a full denominator", () => {
    const value = 1_234_567_890_123_456;
    const matrix = Array.from({ length: 20_000 }, () => [value, value * 2]);
    const { view } = makeDataView(matrix);
    const host = makeDataHost();
    const model = convert(view, host, true, "(Blank)");
    assert.equal(model.drawable, true);
    assert.equal(model.segments.length, 200);
    assert.equal(model.segments.flatMap(segment => segment.cells).length, 400);
    assert.equal(model.partial, true);
    assert.ok(model.diagnostics.some(diagnostic => diagnostic.code === "limit"));
    assert.ok(model.diagnostics.some(diagnostic => diagnostic.code === "precision"));
    assert.ok(model.total < value * 3 * 20_000);
    close(model.segments[0]!.width, 1 / 200);
    close(model.segments[0]!.cells[0]!.overallShare!, 1 / 600);
    assert.equal(model.segments[0]!.cells[0]!.value, value);
});

test("maximum 4,000-cell grids conserve independent rational areas and close the extent", () => {
    for (const [rows, columns] of [[200, 20], [100, 40]]) {
        const matrix = Array.from({ length: rows! }, (_, row) =>
            Array.from({ length: columns! }, (_, column) => (row + 1) * (column + 1)));
        const total = matrix.flat().reduce((a, b) => a + BigInt(b), 0n);
        const model = buildModel(makeModelInput(matrix));
        assert.equal(model.drawable, true);
        assert.equal(model.partial, false);
        for (const segment of model.segments) for (const cell of segment.cells) {
            close(segment.width * cell.height, rational(BigInt(cell.value!), total));
        }
        assert.equal(model.segments.at(-1)!.x + model.segments.at(-1)!.width, 1);
    }
});
