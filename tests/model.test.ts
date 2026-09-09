import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildModel, isPercentageFormat, LIMITS, type ChartModel, type DiagnosticCode, type ModelInput } from "../src/model";
import { makeModelInput, type Matrix } from "./fixtures";

const codes = (model: ChartModel): DiagnosticCode[] => model.diagnostics.map(item => item.code);
const close = (actual: number, expected: number, message = "") =>
    assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${message}: ${actual} != ${expected}`);

function noGeometry(model: ChartModel): void {
    assert.equal(model.drawable, false);
    for (const segment of model.segments) {
        assert.equal(segment.x, 0);
        assert.equal(segment.width, 0);
        for (const cell of segment.cells) {
            assert.equal(cell.y, 0);
            assert.equal(cell.height, 0);
            assert.equal(cell.segmentShare, null);
            assert.equal(cell.overallShare, null);
        }
    }
}

function conservation(model: ChartModel): void {
    assert.equal(model.drawable, true);
    close(model.segments.reduce((total, segment) => total + segment.width, 0), 1, "width conservation");
    let x = 0;
    let area = 0;
    for (const segment of model.segments) {
        close(segment.x, x);
        close(segment.width, segment.total / model.total);
        x += segment.width;
        let stacked = 0;
        for (const cell of segment.cells) {
            assert.ok(Number.isFinite(cell.height) && cell.height >= 0);
            assert.ok(Number.isFinite(cell.y) && cell.y >= -1e-12 && cell.y + cell.height <= 1 + 1e-12);
            close(cell.y + cell.height, 1 - stacked, "contiguous bottom-up stack");
            stacked += cell.height;
            const cellArea = segment.width * cell.height;
            close(cellArea, (cell.value ?? 0) / model.total, "area is overall contribution");
            if (cell.value === null) {
                assert.equal(cell.segmentShare, null);
                assert.equal(cell.overallShare, null);
            } else {
                close(cell.overallShare!, cell.value / model.total);
                if (segment.total > 0) close(cell.segmentShare!, cell.value / segment.total);
                else assert.equal(cell.segmentShare, null);
            }
            area += cellArea;
        }
        close(stacked, segment.total > 0 ? 1 : 0, "height conservation");
    }
    close(area, 1, "area conservation");
}

describe("additive geometry", () => {
    it("conserves column widths, stacked heights, and cell area with distinct denominators", () => {
        const model = buildModel(makeModelInput());
        assert.equal(model.total, 100);
        assert.deepEqual(model.segments.map(segment => segment.total), [40, 60]);
        assert.deepEqual(model.segments.map(segment => segment.width), [0.4, 0.6]);
        assert.equal(model.segments[0]!.cells[0]!.segmentShare, 0.75);
        assert.equal(model.segments[0]!.cells[0]!.overallShare, 0.3);
        assert.deepEqual(codes(model), []);
        conservation(model);
    });

    it("conserves deterministic varied nonnegative data including missing and zero cells", () => {
        let state = 8273;
        const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
        for (let sample = 0; sample < 64; sample++) {
            const rows = 1 + random() % 19;
            const columns = 1 + random() % 13;
            const matrix: unknown[][] = Array.from({ length: rows }, () => Array.from({ length: columns }, () => {
                const value = random() % 100;
                return value < 10 ? null : value < 20 ? 0 : value / 10;
            }));
            matrix[0]![0] = 1;
            conservation(buildModel(makeModelInput(matrix)));
        }
    });

    it("retains zero-width segments without inventing their undefined within-segment shares", () => {
        const model = buildModel(makeModelInput([[0, null], [2, 6], [undefined, 0], [4, 0], [0, 0]]));
        conservation(model);
        for (const index of [0, 2, 4]) {
            const segment = model.segments[index]!;
            assert.equal(segment.width, 0);
            assert.equal(segment.total, 0);
            for (const cell of segment.cells) {
                assert.equal(cell.segmentShare, null);
                assert.equal(cell.height, 0);
                assert.equal(cell.overallShare, cell.value === null ? null : 0);
            }
        }
        assert.deepEqual(model.segments.map(segment => segment.x), [0, 0, 2 / 3, 2 / 3, 1]);
    });

    it("distinguishes missing values from observed zero in mixed positive data", () => {
        const model = buildModel(makeModelInput([[null, undefined, 0, 4]]));
        assert.deepEqual(model.diagnostics, [{ code: "blank", count: 2 }]);
        assert.deepEqual(model.segments[0]!.cells.map(cell => [cell.status, cell.value, cell.segmentShare, cell.overallShare]),
            [["blank", null, null, null], ["blank", null, null, null], ["value", 0, 0, 0], ["value", 4, 1, 1]]);
        conservation(model);
    });

    for (const [name, matrix, expected] of [
        ["all zero", [[0, 0], [0, 0]], "zero"],
        ["zero and missing", [[0, null], [undefined, null]], "zero"],
        ["all missing", [[null, undefined]], "empty"],
        ["no rows", [], "empty"],
        ["no components", [[], []], "empty"]
    ] as const) {
        it(`leaves shares null and geometry absent for ${name}`, () => {
            const model = buildModel(makeModelInput(matrix));
            assert.equal(model.total, 0);
            const blanks = matrix.flat().filter(value => value === null || value === undefined).length;
            assert.deepEqual(model.diagnostics, [...(blanks ? [{ code: "blank", count: blanks }] : []), { code: expected }]);
            noGeometry(model);
        });
    }

    it("retains segment, component and cell identity references and format without mutating input", () => {
        const input = makeModelInput();
        input.segments[0]!.cells[0]!.format = "#,0.00";
        const before = JSON.stringify(input);
        const model = buildModel(input);
        assert.equal(JSON.stringify(input), before);
        model.segments.forEach((segment, row) => {
            assert.strictEqual(segment.identity, input.segments[row]!.identity);
            assert.equal(segment.key, input.segments[row]!.key);
            segment.cells.forEach((cell, column) => {
                assert.strictEqual(cell.identity, input.segments[row]!.cells[column]!.identity);
                assert.equal(cell.segmentIndex, row);
                assert.equal(cell.componentIndex, column);
            });
        });
        model.components.forEach((component, column) => assert.strictEqual(component, input.components[column]));
        assert.equal(model.segments[0]!.cells[0]!.format, "#,0.00");
    });

    it("preserves host segment and component order rather than sorting labels or amounts", () => {
        const input = makeModelInput([[1, 5, 2], [100, 0, 0], [9, 3, 1]]);
        input.segments.forEach((segment, index) => { segment.label = ["March", "January", "February"][index]!; });
        input.components.forEach((component, index) => { component.label = ["Zulu", "Alpha", "Beta"][index]!; });
        const model = buildModel(input);
        assert.deepEqual(model.segments.map(segment => segment.label), ["March", "January", "February"]);
        assert.deepEqual(model.components.map(component => component.label), ["Zulu", "Alpha", "Beta"]);
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.value)), [[1, 5, 2], [100, 0, 0], [9, 3, 1]]);
    });
});

describe("invalid data and arithmetic range", () => {
    for (const [name, value] of [
        ["negative", -1], ["NaN", NaN], ["positive infinity", Infinity], ["negative infinity", -Infinity],
        ["numeric string", "12"], ["empty string", ""], ["boolean", true], ["object", {}], ["bigint", 1n]
    ] as const) {
        it(`rejects ${name} without drawing any otherwise valid geometry`, () => {
            const model = buildModel(makeModelInput([[2, value], [3, 4]]));
            assert.deepEqual(model.diagnostics, [{ code: "invalid", count: 1 }]);
            assert.equal(model.segments[0]!.cells[1]!.status, "invalid");
            assert.equal(model.segments[0]!.cells[1]!.value, null);
            noGeometry(model);
        });
    }

    it("counts invalid and missing values separately", () => {
        const model = buildModel(makeModelInput([[null, undefined, -1, NaN, "0", 0]]));
        assert.deepEqual(model.diagnostics, [{ code: "invalid", count: 3 }, { code: "blank", count: 2 }]);
        noGeometry(model);
    });

    for (const [name, matrix] of [
        ["overflow in a segment", [[Number.MAX_VALUE, Number.MAX_VALUE]]],
        ["overflow across segments", [[Number.MAX_VALUE], [Number.MAX_VALUE]]],
        ["underflow in a cell share", [[Number.MAX_VALUE, Number.MIN_VALUE]]],
        ["underflow in column width", [[Number.MIN_VALUE], [Number.MAX_VALUE]]],
        ["positive height lost to rounding", [[1e16, 1]]],
        ["positive width lost to rounding", [[1e16], [1]]]
    ] satisfies [string, Matrix][]) {
        it(`rejects ${name} and clears all geometry computed before detection`, () => {
            const model = buildModel(makeModelInput(matrix));
            assert.ok(codes(model).includes("range"));
            noGeometry(model);
        });
    }

    for (const [name, matrix] of [
        ["equal subnormal values", [[Number.MIN_VALUE], [Number.MIN_VALUE]]],
        ["large finite values", [[Number.MAX_VALUE / 4, Number.MAX_VALUE / 4], [Number.MAX_VALUE / 4, Number.MAX_VALUE / 4]]],
        ["a single smallest positive value", [[Number.MIN_VALUE]]]
    ] satisfies [string, Matrix][]) {
        it(`does not reject representable geometry for ${name}`, () => {
            const model = buildModel(makeModelInput(matrix));
            assert.ok(!codes(model).includes("range"));
            conservation(model);
        });
    }

    it("rejects malformed normalized input rather than silently synthesizing missing cells", () => {
        const input = makeModelInput();
        input.segments[0]!.cells.pop();
        assert.throws(() => buildModel(input), /Missing cell/);
    });
});

describe("additive contract and bounded denominator", () => {
    for (const [overrides, diagnostic] of [
        [{ additiveConfirmed: false }, "confirm"],
        [{ percentageMeasure: true }, "ratio"],
        [{ identityValid: false }, "identity"]
    ] satisfies [Partial<ModelInput>, DiagnosticCode][]) {
        it(`requires ${diagnostic} contract even when values are positive`, () => {
            const model = buildModel(makeModelInput(undefined, overrides));
            assert.equal(model.total, 100);
            assert.ok(codes(model).includes(diagnostic));
            noGeometry(model);
        });
    }

    it("preserves all independent blocking diagnostics", () => {
        const model = buildModel(makeModelInput(undefined, {
            additiveConfirmed: false, percentageMeasure: true, identityValid: false
        }));
        assert.deepEqual(codes(model), ["confirm", "ratio", "identity"]);
        noGeometry(model);
    });

    it("permits partial data only with an explicit incomplete-denominator diagnostic", () => {
        const complete = buildModel(makeModelInput());
        const partial = buildModel(makeModelInput(undefined, { partial: true }));
        assert.equal(complete.partial, false);
        assert.equal(partial.partial, true);
        assert.deepEqual(codes(partial), ["partial"]);
        assert.equal(partial.total, complete.total);
        assert.deepEqual(partial.segments.map(segment => segment.width), complete.segments.map(segment => segment.width));
        conservation(partial);
    });

    for (const [rows, columns, retainedRows, retainedColumns, limited] of [
        [200, 20, 200, 20, false], [100, 40, 100, 40, false],
        [201, 1, 200, 1, true], [1, 41, 1, 40, true], [200, 40, 100, 40, true],
        [250, 45, 100, 40, true]
    ] as const) {
        it(`bounds ${rows}x${columns} input to ${retainedRows}x${retainedColumns} displayed cells`, () => {
            const matrix = Array.from({ length: rows }, () => Array.from({ length: columns }, () => 1));
            const model = buildModel(makeModelInput(matrix));
            assert.equal(model.segments.length, retainedRows);
            assert.equal(model.components.length, retainedColumns);
            assert.equal(model.total, retainedRows * retainedColumns);
            assert.ok(model.total <= LIMITS.cells);
            assert.equal(model.partial, limited);
            assert.deepEqual(codes(model), limited ? ["partial", "limit"] : []);
            conservation(model);
        });
    }

    it("honors upstream reduction even below local limits", () => {
        const model = buildModel(makeModelInput(undefined, { reduced: true }));
        assert.equal(model.partial, true);
        assert.deepEqual(codes(model), ["partial", "limit"]);
        conservation(model);
    });
});

describe("highlights are overlays, never a replacement denominator", () => {
    const baseGeometry = (model: ChartModel) => ({
        total: model.total,
        segments: model.segments.map(segment => ({
            total: segment.total, x: segment.x, width: segment.width,
            cells: segment.cells.map(({ value, status, segmentShare, overallShare, y, height }) =>
                ({ value, status, segmentShare, overallShare, y, height }))
        }))
    });

    it("retains full values and shares when only a small subset is highlighted", () => {
        const input = makeModelInput(undefined, { hasHighlights: true });
        const highlights = [[3, null], [0, 9]];
        input.segments.forEach((segment, row) => segment.cells.forEach((cell, column) => {
            cell.highlight = highlights[row]![column];
        }));
        const model = buildModel(input);
        assert.equal(model.hasHighlights, true);
        assert.deepEqual(baseGeometry(model), baseGeometry(buildModel(makeModelInput())));
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.highlight)), highlights);
        assert.equal(model.segments[0]!.cells[0]!.highlight! / model.segments[0]!.total, 3 / 40);
        conservation(model);
    });

    it("accepts empty and all-zero highlight selections without changing the chart", () => {
        for (const highlight of [null, undefined, 0]) {
            const input = makeModelInput(undefined, { hasHighlights: true });
            input.segments.forEach(segment => segment.cells.forEach(cell => { cell.highlight = highlight; }));
            const model = buildModel(input);
            assert.equal(model.hasHighlights, true);
            assert.ok(!codes(model).includes("highlight"));
            assert.deepEqual(baseGeometry(model), baseGeometry(buildModel(makeModelInput())));
        }
    });

    for (const [name, highlight] of [
        ["negative", -1], ["greater than base", 31], ["NaN", NaN], ["infinity", Infinity],
        ["numeric string", "3"], ["boolean", true]
    ] as const) {
        it(`disables the entire overlay for ${name}, but preserves valid base geometry`, () => {
            const input = makeModelInput(undefined, { hasHighlights: true });
            input.segments[0]!.cells[0]!.highlight = highlight;
            input.segments[1]!.cells[0]!.highlight = 2;
            const model = buildModel(input);
            assert.equal(model.hasHighlights, false);
            assert.equal(model.segments[0]!.cells[0]!.highlight, null);
            assert.deepEqual(model.diagnostics, [{ code: "highlight", count: 1 }]);
            assert.deepEqual(baseGeometry(model), baseGeometry(buildModel(makeModelInput())));
            conservation(model);
        });
    }

    it("disallows a positive highlight for missing or zero base values and counts both", () => {
        const input = makeModelInput([[null, 0, 5]], { hasHighlights: true });
        input.segments[0]!.cells.forEach(cell => { cell.highlight = 1; });
        const model = buildModel(input);
        assert.equal(model.hasHighlights, false);
        assert.deepEqual(model.diagnostics, [{ code: "blank", count: 1 }, { code: "highlight", count: 2 }]);
        conservation(model);
    });

    it("does not enable overlays merely because normalized cells have a highlight", () => {
        const input = makeModelInput();
        input.segments[0]!.cells[0]!.highlight = 3;
        assert.equal(buildModel(input).hasHighlights, false);
    });
});

describe("percentage format recognition", () => {
    for (const format of ["0%", "0.00 %", "#,0.0%;(#,0.0%)", '0.0;"literal";0%', "[Red]0%", '0"units"%']) {
        it(`rejects scaling format ${format}`, () => assert.equal(isPercentageFormat(format), true));
    }
    for (const format of [undefined, "", "#,0.00", "0.0‰", '0"%"', "0'%'",
        "0\\%", "0_%", '"100% literal"0.00', '0.0;"quoted %";0\\%']) {
        it(`allows literal/non-percentage format ${String(format)}`, () => assert.equal(isPercentageFormat(format), false));
    }
});
