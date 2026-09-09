import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type powerbi from "powerbi-visuals-api";
import { convert } from "../src/data";
import { LIMITS, type ChartModel } from "../src/model";
import { makeDataHost, makeDataView, TestSelectionId, type DataViewFixture } from "./fixtures";

const codes = (model: ChartModel) => model.diagnostics.map(item => item.code);
const run = (fixture = makeDataView(), confirmed = true) => convert(fixture.view, makeDataHost(), confirmed, "(Blank)");
const geometry = (model: ChartModel) => model.segments.map(segment => ({
    total: segment.total, width: segment.width, x: segment.x,
    cells: segment.cells.map(({ value, status, segmentShare, overallShare, y, height }) =>
        ({ value, status, segmentShare, overallShare, y, height }))
}));

function noGeometry(model: ChartModel): void {
    assert.equal(model.drawable, false);
    for (const segment of model.segments) {
        assert.equal(segment.width, 0);
        assert.equal(segment.x, 0);
        for (const cell of segment.cells) {
            assert.equal(cell.height, 0);
            assert.equal(cell.y, 0);
            assert.equal(cell.segmentShare, null);
            assert.equal(cell.overallShare, null);
        }
    }
}

describe("categorical binding and value normalization", () => {
    it("converts grouped columns into row-major geometry without mutating the host view", () => {
        const fixture = makeDataView();
        const before = JSON.stringify(fixture.view);
        const model = run(fixture);
        assert.equal(model.drawable, true);
        assert.equal(model.total, 100);
        assert.equal(model.partial, false);
        assert.deepEqual(codes(model), []);
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.value)), [[30, 10], [15, 45]]);
        assert.deepEqual(model.segments.map(segment => segment.width), [0.4, 0.6]);
        assert.equal(JSON.stringify(fixture.view), before);
    });

    it("reports a binding error for no DataView", () => {
        const model = convert(undefined, makeDataHost(), true, "(Blank)");
        assert.deepEqual(model.diagnostics, [{ code: "binding" }]);
        noGeometry(model);
    });

    const malformed: [string, (fixture: DataViewFixture) => void][] = [
        ["missing categorical data", fixture => { delete fixture.view.categorical; }],
        ["missing categories", fixture => { delete fixture.view.categorical!.categories; }],
        ["missing segment role", fixture => { fixture.category.source.roles = { other: true }; }],
        ["missing values", fixture => { delete fixture.view.categorical!.values; }],
        ["missing series source", fixture => { delete fixture.values.source; }],
        ["missing component role", fixture => { fixture.values.source!.roles = { other: true }; }],
        ["empty groups", fixture => { fixture.groups.splice(0); }],
        ["group with no measures", fixture => { fixture.groups[0]!.values = []; }],
        ["group with multiple measures", fixture => { fixture.groups[0]!.values.push(fixture.groups[0]!.values[0]!); }],
        ["missing value role", fixture => { fixture.groups[0]!.values[0]!.source.roles = { other: true }; }]
    ];
    for (const [name, mutate] of malformed) {
        it(`reports binding error for ${name}`, () => {
            const fixture = makeDataView();
            mutate(fixture);
            const host = makeDataHost();
            const model = convert(fixture.view, host, true, "(Blank)");
            assert.deepEqual(model.diagnostics, [{ code: "binding" }]);
            assert.equal(model.segments.length, 0);
            assert.equal(host.builders.length, 0);
            noGeometry(model);
        });
    }

    it("finds the segment role instead of assuming the first category is the segment", () => {
        const fixture = makeDataView();
        fixture.view.categorical!.categories!.unshift({
            source: { displayName: "Unrelated", roles: { other: true } }, values: ["Wrong", "Order"]
        });
        assert.deepEqual(run(fixture).segments.map(segment => segment.label), ["Segment 0", "Segment 1"]);
    });

    it("treats a bound empty category as empty data rather than a binding failure", () => {
        const model = run(makeDataView([]));
        assert.deepEqual(codes(model), ["empty"]);
        assert.equal(model.total, 0);
        noGeometry(model);
    });

    it("preserves null and absent values as missing, not observed zero", () => {
        const fixture = makeDataView([[null, 0], [5, 7], [3, 9]]);
        fixture.groups[1]!.values[0]!.values.pop();
        const model = run(fixture);
        assert.equal(model.drawable, true);
        assert.equal(model.total, 15);
        assert.deepEqual(model.diagnostics, [{ code: "blank", count: 2 }]);
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.status)),
            [["blank", "value"], ["value", "value"], ["value", "blank"]]);
        assert.equal(model.segments[0]!.width, 0);
        assert.equal(model.segments[0]!.cells[0]!.overallShare, null);
        assert.equal(model.segments[0]!.cells[1]!.overallShare, 0);
        assert.equal(model.segments[0]!.cells[1]!.segmentShare, null);
    });

    for (const [name, value] of [
        ["negative", -3], ["NaN", NaN], ["infinity", Infinity], ["negative infinity", -Infinity],
        ["numeric string", "10"], ["empty string", ""], ["boolean", false]
    ] as const) {
        it(`does not coerce ${name} into valid geometry`, () => {
            const model = run(makeDataView([[value, 10]]));
            assert.deepEqual(model.diagnostics, [{ code: "invalid", count: 1 }]);
            assert.equal(model.segments[0]!.cells[0]!.status, "invalid");
            noGeometry(model);
        });
    }
});

describe("native host identities and ordering", () => {
    it("retains exact identities issued by withCategory, withSeries, and withMeasure", () => {
        const fixture = makeDataView();
        const host = makeDataHost();
        const model = convert(fixture.view, host, true, "(Blank)");
        const builderFor = (identity: powerbi.visuals.ISelectionId) => {
            const index = host.identities.indexOf(identity);
            assert.notEqual(index, -1, "output must retain the host identity object, not a synthesized replacement");
            return host.builders[index]!;
        };
        assert.equal(host.builders.length, 2 + 2 + 4);
        model.components.forEach((component, column) => {
            const calls = builderFor(component.identity).calls;
            assert.equal(calls.length, 1);
            assert.equal(component.key, component.identity.getKey());
            const call = calls[0]!;
            assert.ok(call.method === "withSeries");
            assert.strictEqual(call.column, fixture.values);
            assert.strictEqual(call.group, fixture.groups[column]);
        });
        model.segments.forEach((segment, row) => {
            const calls = builderFor(segment.identity).calls;
            assert.equal(calls.length, 1);
            assert.equal(segment.key, segment.identity.getKey());
            const categoryCall = calls[0]!;
            assert.ok(categoryCall.method === "withCategory");
            assert.strictEqual(categoryCall.column, fixture.category);
            assert.equal(categoryCall.index, row);
            segment.cells.forEach((cell, column) => {
                const cellCalls = builderFor(cell.identity).calls;
                assert.deepEqual(cellCalls.map(call => call.method), ["withCategory", "withSeries", "withMeasure"]);
                const [category, series, measure] = cellCalls;
                assert.ok(category?.method === "withCategory");
                assert.strictEqual(category.column, fixture.category);
                assert.equal(category.index, row);
                assert.ok(series?.method === "withSeries");
                assert.strictEqual(series.column, fixture.values);
                assert.strictEqual(series.group, fixture.groups[column]);
                assert.ok(measure?.method === "withMeasure");
                assert.equal(measure.measure, "Fact.Amount");
                assert.ok(segment.identity.includes(cell.identity));
                assert.ok(model.components[column]!.identity.includes(cell.identity));
            });
        });
        assert.equal(new Set(host.identities.map(identity => identity.getKey())).size, host.identities.length);
    });

    it("uses blank display labels without merging distinct host entities or literal blank-looking labels", () => {
        const fixture = makeDataView(Array.from({ length: 4 }, () => [1, 2, 3, 4]), {
            segmentLabels: [null, undefined, "(Blank)", ""],
            componentLabels: [null, undefined, "(Blank)", ""]
        });
        const model = run(fixture);
        assert.equal(model.drawable, true);
        assert.deepEqual(model.segments.map(segment => segment.label), ["(Blank)", "(Blank)", "(Blank)", ""]);
        assert.deepEqual(model.components.map(component => component.label), ["(Blank)", "(Blank)", "(Blank)", ""]);
        assert.equal(new Set(model.segments.map(segment => segment.key)).size, 4);
        assert.equal(new Set(model.components.map(component => component.key)).size, 4);
        assert.equal(new Set(model.segments.flatMap(segment => segment.cells.map(cell => cell.identity.getKey()))).size, 16);
        assert.deepEqual(codes(model), []);
    });

    it("preserves host sort-by order even when labels and magnitudes suggest another order", () => {
        const fixture = makeDataView([[1, 3, 2], [100, 2, 4], [2, 2, 2]], {
            segmentLabels: ["March", "January", "February"], componentLabels: ["Zulu", "Alpha", "Beta"]
        });
        fixture.category.source.sort = 1;
        fixture.category.source.sortOrder = 0;
        const model = run(fixture);
        assert.deepEqual(model.segments.map(segment => segment.label), ["March", "January", "February"]);
        assert.deepEqual(model.components.map(component => component.label), ["Zulu", "Alpha", "Beta"]);
        assert.deepEqual(model.segments.map(segment => segment.total), [6, 106, 6]);
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.value)), [[1, 3, 2], [100, 2, 4], [2, 2, 2]]);
    });

    it("keeps identity keys stable across reordering, localized blank names, and relabeling", () => {
        const first = run(makeDataView([[1, 2], [3, 4]], {
            segmentLabels: [null, "Old label"], componentLabels: ["X", "Y"],
            segmentKeys: ["a", "b"], componentKeys: ["x", "y"]
        }));
        const fixture = makeDataView([[4, 3], [2, 1]], {
            segmentLabels: ["New label", null], componentLabels: ["Y renamed", "X renamed"],
            segmentKeys: ["b", "a"], componentKeys: ["y", "x"]
        });
        const second = convert(fixture.view, makeDataHost("fr-FR"), true, "(Vide)");
        assert.equal(first.segments[0]!.key, second.segments[1]!.key);
        assert.equal(first.components[0]!.key, second.components[1]!.key);
        assert.equal(first.segments[0]!.cells[0]!.identity.getKey(), second.segments[1]!.cells[1]!.identity.getKey());
        assert.equal(second.segments[1]!.label, "(Vide)");
    });

    const invalidIdentities: [string, (fixture: DataViewFixture) => void][] = [
        ["missing category identities", fixture => { delete fixture.category.identity; }],
        ["missing one category identity", fixture => { fixture.category.identity!.pop(); }],
        ["missing component identity", fixture => { delete fixture.groups[0]!.identity; }],
        ["duplicate category identity", fixture => { fixture.category.identity![1] = fixture.category.identity![0]!; }],
        ["duplicate component identity", fixture => { fixture.groups[1]!.identity = fixture.groups[0]!.identity; }],
        ["missing measure query name", fixture => { delete fixture.groups[0]!.values[0]!.source.queryName; }],
        ["empty measure query name", fixture => { fixture.groups[0]!.values[0]!.source.queryName = ""; }]
    ];
    for (const [name, mutate] of invalidIdentities) {
        it(`blocks drawing for ${name}`, () => {
            const fixture = makeDataView();
            mutate(fixture);
            const model = run(fixture);
            assert.deepEqual(codes(model), ["identity"]);
            noGeometry(model);
        });
    }

    for (const scope of ["category", "component", "cell"] as const) {
        it(`honors hasIdentity() false for a host-created ${scope} identity`, () => {
            const host = makeDataHost("en-US", (parts, valid) => {
                const matches = scope === "cell" ? parts.length === 3 :
                    parts.length === 1 && parts[0]!.startsWith(scope === "category" ? "category:" : "series:");
                return new TestSelectionId(parts, valid && !matches);
            });
            const model = convert(makeDataView().view, host, true, "(Blank)");
            assert.deepEqual(codes(model), ["identity"]);
            noGeometry(model);
        });
    }

    it("detects duplicate host-generated keys even when source identities differ", () => {
        const host = makeDataHost("en-US", () => new TestSelectionId(["same-key"]));
        const model = convert(makeDataView().view, host, true, "(Blank)");
        assert.deepEqual(codes(model), ["identity"]);
        noGeometry(model);
    });
});

describe("measure formats, confirmation, and labels", () => {
    it("requires explicit additive confirmation and still rejects known percentages after confirmation", () => {
        const unconfirmed = run(makeDataView(), false);
        assert.deepEqual(codes(unconfirmed), ["confirm"]);
        noGeometry(unconfirmed);
        for (const confirmed of [false, true]) {
            const model = run(makeDataView(undefined, { measureFormat: "0.0%" }), confirmed);
            assert.deepEqual(codes(model), confirmed ? ["ratio"] : ["confirm", "ratio"]);
            noGeometry(model);
        }
    });

    it("rejects a percentage source format on any component", () => {
        const fixture = makeDataView();
        fixture.groups[1]!.values[0]!.source.format = "0.0%";
        const model = run(fixture);
        assert.deepEqual(codes(model), ["ratio"]);
        noGeometry(model);
    });

    it("rejects cell-level dynamic percentage formats and retains each cell's effective format", () => {
        const model = run(makeDataView(undefined, {
            measureFormat: "#,0", dynamicFormats: [[undefined, "0.00"], ["0.0%", undefined]]
        }));
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.format)), [["#,0", "0.00"], ["0.0%", "#,0"]]);
        assert.deepEqual(codes(model), ["ratio"]);
        noGeometry(model);
    });

    it("does not let a non-percentage dynamic format bypass a known percentage measure", () => {
        const model = run(makeDataView([[1]], { measureFormat: "0%", dynamicFormats: [["0.00"]] }));
        assert.deepEqual(codes(model), ["ratio"]);
        noGeometry(model);
    });

    it("permits an escaped literal percentage sign and uses source format for non-string dynamic objects", () => {
        const fixture = makeDataView([[1]], { measureFormat: "0\\%" });
        fixture.groups[0]!.values[0]!.objects = [{ general: { formatString: 123 } }];
        const model = run(fixture);
        assert.equal(model.drawable, true);
        assert.equal(model.segments[0]!.cells[0]!.format, "0\\%");
    });

    it("formats dimensions with their own formats rather than the measure format", () => {
        const model = run(makeDataView([[12]], {
            segmentLabels: [7], componentLabels: [9], segmentFormat: "0000", componentFormat: "000",
            measureFormat: "#,0.00"
        }));
        assert.equal(model.segments[0]!.label, "0007");
        assert.equal(model.components[0]!.label, "009");
        assert.equal(model.segments[0]!.cells[0]!.format, "#,0.00");
    });

    it("bounds large dimension labels while preserving identity and full numeric values", () => {
        const model = run(makeDataView([[12]], { segmentLabels: ["S".repeat(3000)], componentLabels: ["C".repeat(3000)] }));
        assert.equal(model.segments[0]!.label, "S".repeat(2048));
        assert.equal(model.components[0]!.label, "C".repeat(2048));
        assert.equal(model.total, 12);
        assert.equal(model.drawable, true);
    });
});

describe("partial data, reductions, and display limits", () => {
    it("retains metadata.segment as an explicit partial displayed denominator", () => {
        const complete = run(makeDataView());
        const partial = run(makeDataView(undefined, { partial: true }));
        assert.equal(partial.partial, true);
        assert.deepEqual(codes(partial), ["partial"]);
        assert.equal(partial.total, complete.total);
        assert.deepEqual(geometry(partial), geometry(complete));
        assert.equal(partial.drawable, true);
    });

    for (const [rows, columns, retainedRows, retainedColumns, limited] of [
        [200, 20, 200, 20, false], [100, 40, 100, 40, false],
        [201, 1, 200, 1, true], [1, 41, 1, 40, true], [200, 40, 100, 40, true], [201, 41, 100, 40, true]
    ] as const) {
        it(`converts only the ${retainedRows}x${retainedColumns} displayed prefix of ${rows}x${columns}`, () => {
            const fixture = makeDataView(Array.from({ length: rows }, (_, row) =>
                Array.from({ length: columns }, (_, column) => row < retainedRows && column < retainedColumns ? 1 : 1000)));
            const host = makeDataHost();
            const model = convert(fixture.view, host, true, "(Blank)");
            assert.equal(model.drawable, true);
            assert.equal(model.segments.length, retainedRows);
            assert.equal(model.components.length, retainedColumns);
            assert.equal(model.total, retainedRows * retainedColumns);
            assert.ok(model.total <= LIMITS.cells);
            assert.equal(model.partial, limited);
            assert.deepEqual(codes(model), limited ? ["partial", "limit"] : []);
            assert.equal(host.builders.length, retainedColumns + retainedRows + retainedRows * retainedColumns);
            assert.equal(model.segments.at(-1)!.label, `Segment ${retainedRows - 1}`);
            assert.equal(model.components.at(-1)!.label, `Component ${retainedColumns - 1}`);
        });
    }
});

describe("categorical highlights", () => {
    it("uses the full amount denominator rather than sums of highlight columns", () => {
        const baseline = run(makeDataView());
        const model = run(makeDataView(undefined, { highlights: [[3, null], [0, 9]] }));
        assert.equal(model.hasHighlights, true);
        assert.equal(model.total, 100);
        assert.deepEqual(geometry(model), geometry(baseline));
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.highlight)), [[3, null], [0, 9]]);
    });

    it("distinguishes an absent highlight field from present all-null or empty arrays", () => {
        assert.equal(run(makeDataView()).hasHighlights, false);
        assert.equal(run(makeDataView(undefined, { highlights: [[null, null], [null, null]] })).hasHighlights, true);
        assert.equal(run(makeDataView(undefined, { highlights: [] })).hasHighlights, true);
    });

    it("supports highlights on just one component without treating other components as invalid", () => {
        const fixture = makeDataView(undefined, { highlights: [[3, null], [0, null]] });
        delete fixture.groups[1]!.values[0]!.highlights;
        const model = run(fixture);
        assert.equal(model.hasHighlights, true);
        assert.deepEqual(codes(model), []);
        assert.deepEqual(model.segments.map(segment => segment.cells.map(cell => cell.highlight)), [[3, null], [0, null]]);
    });

    for (const [name, highlight] of [
        ["negative", -1], ["too large", 31], ["nonfinite", Infinity], ["NaN", NaN], ["string", "3"]
    ] as const) {
        it(`disables ${name} highlights without changing the base chart`, () => {
            const model = run(makeDataView(undefined, { highlights: [[highlight, null], [0, 9]] }));
            assert.equal(model.hasHighlights, false);
            assert.equal(model.drawable, true);
            assert.deepEqual(model.diagnostics, [{ code: "highlight", count: 1 }]);
            assert.deepEqual(geometry(model), geometry(run(makeDataView())));
            assert.equal(model.total, 100);
        });
    }
});
