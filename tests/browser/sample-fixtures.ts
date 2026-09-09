import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Fixture } from "./host";

export async function sampleFixture(kind: "market" | "product-mix") {
    const name = kind === "market" ? "product-region-market-share.csv" : "business-unit-product-mix.csv";
    const model = kind === "market" ? "ProductRegion.tmdl" : "BusinessUnitMix.tmdl";
    const source = resolve("samples", "data", name);
    const bytes = await readFile(source);
    const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
    // These repository fixtures have a deliberately simple five-column schema; fail instead of silently misreading quoted CSV.
    assert.ok(!text.includes('"'), "Sample CSV introduced quoted fields; update its reader before capturing evidence");
    const lines = text.trimEnd().split(/\r?\n/).map(line => line.split(","));
    const header = lines.shift()!;
    assert.deepEqual(header, kind === "market" ?
        ["Region", "RegionOrder", "Product", "ProductOrder", "Revenue"] :
        ["BusinessUnit", "BusinessUnitOrder", "Product", "ProductOrder", "Revenue"]);
    const rows = lines.map(cells => {
        assert.equal(cells.length, 5, "Sample CSV must preserve the empty final Revenue field");
        const [segment, segmentOrder, component, componentOrder, raw] = cells;
        const value = raw === "" ? null : Number(raw);
        assert.ok(value === null || Number.isFinite(value) && value >= 0);
        assert.ok(Number.isFinite(Number(segmentOrder)) && Number.isFinite(Number(componentOrder)));
        return { segment: segment!, segmentOrder: Number(segmentOrder), component: component!,
            componentOrder: Number(componentOrder), value };
    });
    const segments = [...new Map([...rows].sort((a, b) => a.segmentOrder - b.segmentOrder).map(row => [row.segment, row.segmentOrder])).keys()];
    const components = [...new Map([...rows].sort((a, b) => a.componentOrder - b.componentOrder).map(row => [row.component, row.componentOrder])).keys()];
    const values = segments.map(segment => components.map(component => {
        const cells = rows.filter(row => row.segment === segment && row.component === component);
        assert.equal(cells.length, 1, "CSV fixture must explicitly supply exactly one row for every cell");
        return cells[0]!.value;
    }));
    const modelPath = resolve("samples", "AtlynMarimekko.SemanticModel", "definition", "tables", model);
    const modelText = await readFile(modelPath, "utf8");
    const format = /^\s*formatString:\s*(.+)$/m.exec(modelText)?.[1];
    assert.ok(format, "The sample's model measure format is required");
    const fixture: Fixture = { segments, components, values, format, additive: true };
    return { kind, fixture, source: {
        csv: source, csvSha256: createHash("sha256").update(bytes).digest("hex"), rows: rows.length,
        semanticModel: modelPath, modelFormat: format, dimensionOrder: header.slice(0, 4),
        total: rows.reduce((sum, row) => sum + (row.value ?? 0), 0),
        missingCells: rows.filter(row => row.value === null).length, observedZeroCells: rows.filter(row => row.value === 0).length
    } };
}
