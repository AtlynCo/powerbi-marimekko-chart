import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import JSZip from "jszip";

interface VisualIdentity { guid: string; name: string; version: string }
interface PackageMetadata {
    version: string;
    visual: VisualIdentity;
    metadata: { pbivizjson: { resourceId: string } };
    resources: { resourceId: string; sourceType: number; file: string }[];
}
interface Payload {
    visual: VisualIdentity;
    apiVersion: string;
    capabilities: { privileges: unknown[]; dataRoles: { name: string; kind: string }[] };
    content: { js: string; css: string; iconBase64: string };
    externalJS: unknown[];
    stringResources: Record<string, unknown>;
}
interface ResourceItem { name: string; path: string; type: string }
interface Report {
    $schema: string;
    resourcePackages: { name: string; type: string; items: ResourceItem[] }[];
    publicCustomVisuals?: string[];
    organizationCustomVisuals?: unknown[];
    annotations: { name: string; value: string }[];
}
interface SemanticField { Expression: { SourceRef: { Entity: string } }; Property: string }
interface Projection {
    field: { Column?: SemanticField; Measure?: SemanticField };
    queryRef: string;
}
interface Visual {
    name: string;
    position: { x: number; y: number; width: number; height: number; tabOrder: number };
    visual: {
        visualType: string;
        query?: {
            queryState: Record<string, { projections: Projection[]; showAll?: boolean }>;
            sortDefinition: { sort: { field: { Column: SemanticField }; direction: string }[] };
        };
        objects?: Record<string, { properties: Record<string, unknown> }[]>;
        visualContainerObjects?: Record<string, { properties: Record<string, unknown> }[]>;
    };
}
interface Assembly {
    visual: VisualIdentity & { apiVersion: string };
    package: { file: string; sha256: string; bytes: number; modified: boolean };
    embedding: { root: string; metadataResource: string; javascriptSha256: string; cssSha256: string; iconSha256: string; locales: string[] };
    generatedFiles: { path: string; sha256: string; bytes: number }[];
    nativeValidation: { desktop: string; service: string; pbixGenerated: boolean };
    sources: Record<string, string>;
}

const root = resolve(".");
const samples = join(root, "samples");
const reportRoot = join(samples, "AtlynMarimekko.Report");
const guid = "AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472";
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const source = readJson<{ visual: VisualIdentity; apiVersion: string }>(join(root, "pbiviz.json"));
const trace = readJson<Assembly>(join(samples, "assembly-manifest.json"));
const report = readJson<Report>(join(reportRoot, "definition", "report.json"));
const customRoot = join(reportRoot, "CustomVisuals", guid);
const packageManifest = readJson<PackageMetadata>(join(customRoot, "package.json"));
const metadataResource = packageManifest.resources.find(item => item.resourceId === packageManifest.metadata.pbivizjson.resourceId)!;
const payload = readJson<Payload>(join(customRoot, ...metadataResource.file.split("/")));
const samplePages = [
    { name: "MarketShare", prefix: "Market", entity: "ProductRegion", segment: "Region", measure: "Market Revenue", order: "RegionOrder", csv: "product-region-market-share.csv" },
    { name: "ProductMix", prefix: "Mix", entity: "BusinessUnitMix", segment: "BusinessUnit", measure: "Mix Revenue", order: "BusinessUnitOrder", csv: "business-unit-product-mix.csv" }
];
const readVisual = (page: string, name: string) => readJson<Visual>(
    join(reportRoot, "definition", "pages", page, "visuals", name, "visual.json")
);
const literalValue = (property: unknown): string => (property as { expr: { Literal: { Value: string } } }).expr.Literal.Value;

describe("authored offline sample source (not native Power BI acceptance)", () => {
    it("embeds the exact SDK manifest/payload and resolves PBIR private-visual metadata", () => {
        assert.equal(trace.visual.guid, guid);
        assert.equal(trace.visual.version, source.visual.version);
        assert.equal(trace.visual.apiVersion, source.apiVersion);
        assert.deepEqual(packageManifest.visual, source.visual);
        assert.equal(packageManifest.version, source.visual.version);
        assert.deepEqual(payload.visual, source.visual);
        assert.equal(payload.apiVersion, source.apiVersion);
        assert.equal(metadataResource.sourceType, 5);
        assert.deepEqual(report.publicCustomVisuals ?? [], []);
        assert.deepEqual(report.organizationCustomVisuals ?? [], []);
        const custom = report.resourcePackages.filter(item => item.type === "CustomVisual");
        assert.equal(custom.length, 1);
        assert.equal(custom[0]!.name, guid);
        assert.deepEqual(custom[0]!.items, [{
            name: basename(metadataResource.file), path: basename(metadataResource.file), type: "CustomVisualMetadata"
        }]);
        assert.equal(sha256(payload.content.js), trace.embedding.javascriptSha256);
        assert.equal(sha256(payload.content.css), trace.embedding.cssSha256);
        assert(payload.content.js.includes(guid));
        assert(payload.content.css.length > 0);
        assert.deepEqual(payload.capabilities.privileges, []);
        assert.deepEqual(payload.externalJS, []);
        assert.deepEqual(Object.keys(payload.stringResources).sort(), ["en-US", "fr-FR"]);
    });

    it("registers and uses the same packaged PNG icon with native image resource expressions", () => {
        const registered = report.resourcePackages.find(item => item.type === "RegisteredResources")!;
        assert.equal(registered.name, "RegisteredResources");
        assert.equal(registered.items.length, 1);
        const icon = registered.items[0]!;
        assert.equal(icon.type, "Image");
        const bytes = readFileSync(join(reportRoot, "StaticResources", "RegisteredResources", icon.path));
        assert(bytes.equals(Buffer.from(payload.content.iconBase64.split(",")[1]!, "base64")));
        assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.equal(sha256(bytes), trace.embedding.iconSha256);
        for (const page of samplePages) {
            const image = readVisual(page.name, `${page.prefix}Icon`);
            assert.equal(image.visual.visualType, "image");
            assert.deepEqual(image.visual.objects!.general![0]!.properties.imageUrl, {
                expr: { ResourcePackageItem: { PackageName: "RegisteredResources", PackageType: 1, ItemName: icon.name } }
            });
        }
    });

    for (const page of samplePages) {
        it(`${page.name} binds native roles, confirms its SUM measure, and authors reconciliation/highlight interactions`, () => {
            const chart = readVisual(page.name, `${page.prefix}Marimekko`);
            const table = readVisual(page.name, `${page.prefix}Baseline`);
            assert.equal(chart.visual.visualType, guid);
            assert.equal(table.visual.visualType, "tableEx");
            const query = chart.visual.query!;
            assert.deepEqual(Object.keys(query.queryState).sort(), ["component", "segment", "value"]);
            for (const [role, property, kind] of [
                ["segment", page.segment, "Column"], ["component", "Product", "Column"], ["value", page.measure, "Measure"]
            ] as const) {
                const projections = query.queryState[role]!.projections;
                assert.equal(projections.length, 1);
                assert.deepEqual(projections[0]!.field, {
                    [kind]: { Expression: { SourceRef: { Entity: page.entity } }, Property: property }
                });
                assert.equal(projections[0]!.queryRef, `${page.entity}.${property}`);
            }
            assert.equal(query.queryState.segment!.showAll, true);
            assert.equal(query.queryState.component!.showAll, true);
            assert.equal(literalValue(chart.visual.objects!.dataContract![0]!.properties.additiveConfirmed), "true");
            assert.equal(literalValue(chart.visual.objects!.appearance![0]!.properties.labelContent), "'segmentShare'");
            assert.deepEqual(table.visual.query!.queryState.Values!.projections,
                ["segment", "component", "value"].flatMap(role => query.queryState[role]!.projections));
            assert.equal(query.sortDefinition.sort[0]!.field.Column.Property, page.segment);
            assert.equal(query.sortDefinition.sort[0]!.direction, "Ascending");
            const definition = readJson<{ width: number; height: number; visualInteractions: unknown[] }>(
                join(reportRoot, "definition", "pages", page.name, "page.json")
            );
            assert.deepEqual(definition.visualInteractions, [
                { source: chart.name, target: table.name, type: "DataFilter" },
                { source: table.name, target: chart.name, type: "HighlightFilter" }
            ]);
            const visualDir = join(reportRoot, "definition", "pages", page.name, "visuals");
            const visualNames = readdirSync(visualDir).filter(name => existsSync(join(visualDir, name, "visual.json")));
            assert.equal(visualNames.length, 5);
            for (const name of visualNames) {
                const visual = readVisual(page.name, name);
                assert.equal(name, visual.name);
                assert(visual.position.x >= 0 && visual.position.y >= 0);
                assert(visual.position.x + visual.position.width <= definition.width);
                assert(visual.position.y + visual.position.height <= definition.height);
                assert.doesNotMatch(JSON.stringify(visual), /import the .pbiviz|add it below|bind .*->/i);
            }
        });
    }

    it("keeps local CSV import, explicit SUM measures, sorting and missing-versus-zero values", () => {
        const measureNames = new Set<string>();
        const expression = readFileSync(join(samples, "AtlynMarimekko.SemanticModel", "definition", "expressions.tmdl"), "utf8");
        assert.match(expression, /expression SampleDataFolder = "C:\\AtlynMarimekko\\samples\\data"/);
        assert.match(expression, /IsParameterQuery=true/);
        for (const page of samplePages) {
            const table = readFileSync(join(samples, "AtlynMarimekko.SemanticModel", "definition", "tables", `${page.entity}.tmdl`), "utf8");
            assert(table.includes(`measure '${page.measure}' = SUM(${page.entity}[Revenue])`));
            for (const match of table.matchAll(/^\tmeasure '([^']+)' =/gm)) {
                const name = match[1]!.toLowerCase();
                assert(!measureNames.has(name), "DAX measure names must be unique across the model");
                measureNames.add(name);
            }
            assert(table.includes(`sortByColumn: ${page.order}`));
            assert(table.includes("sortByColumn: ProductOrder"));
            for (const property of [page.segment, page.order, "Product", "ProductOrder", "Revenue"]) {
                assert.match(table, new RegExp(`^\\tcolumn ${property}\\r?$`, "m"));
            }
            assert(table.includes("mode: import"));
            assert(table.includes(`File.Contents(SampleDataFolder & "\\${page.csv}")`));
            assert(table.includes('then null else Number.FromText(_, "en-US")'));
            assert.doesNotMatch(table, /Web\.Contents|https?:\/\//);
            const lines = readFileSync(join(samples, "data", page.csv), "utf8").trim().split(/\r?\n/);
            const headers = lines.shift()!.split(",");
            const rows = lines.map(line => Object.fromEntries(line.split(",").map((value, index) => [headers[index]!, value])));
            const values = rows.map(row => row.Revenue === "" ? null : Number(row.Revenue));
            assert(values.every(value => value === null || (Number.isFinite(value) && value >= 0)));
            assert.equal(values.reduce<number>((total, value) => total + (value ?? 0), 0), 1_000_000);
            assert.equal(values.filter(value => value === null).length, page.name === "ProductMix" ? 1 : 0);
            const totals = new Map<string, number>();
            for (const row of rows) totals.set(row[page.segment]!, (totals.get(row[page.segment]!) ?? 0) + Number(row.Revenue));
            assert.deepEqual([...totals.values()], page.name === "MarketShare"
                ? [600_000, 300_000, 100_000] : [800_000, 150_000, 45_000, 5_000, 0]);
            if (page.name === "ProductMix") {
                assert.equal(rows.find(row => row.BusinessUnit === "Incubator" && row.Product === "Comet")!.Revenue, "");
                assert.equal(rows.find(row => row.BusinessUnit === "Incubator" && row.Product === "Beacon")!.Revenue, "0");
                assert(rows.filter(row => row.BusinessUnit === "Retired").every(row => row.Revenue === "0"));
            }
        }
    });

    it("resolves project/model paths and independently checks every generated-file hash", () => {
        const project = readJson<{ artifacts: { report: { path: string } }[] }>(join(samples, "AtlynMarimekko.pbip"));
        assert.equal(project.artifacts[0]!.report.path, "AtlynMarimekko.Report");
        const binding = readJson<{ datasetReference: { byPath: { path: string } } }>(join(reportRoot, "definition.pbir"));
        assert(existsSync(join(reportRoot, binding.datasetReference.byPath.path, "definition.pbism")));
        for (const item of trace.generatedFiles) {
            assert(!item.path.includes("..") && !item.path.includes("\\") && !item.path.startsWith("/"));
            const bytes = readFileSync(join(samples, ...item.path.split("/")));
            assert.equal(bytes.length, item.bytes, item.path);
            assert.equal(sha256(bytes), item.sha256, item.path);
        }
        assert.equal(report.annotations.find(item => item.name === "AtlynPackageSha256")!.value, trace.package.sha256);
        assert.equal(report.annotations.find(item => item.name === "AtlynPackageVersion")!.value, source.visual.version);
        assert.deepEqual(trace.nativeValidation, {
            desktop: "pending-owner-validation", service: "pending-owner-validation", pbixGenerated: false
        });
        assert.equal(trace.package.modified, false);
        assert(trace.sources.reportResources!.startsWith("https://developer.microsoft.com/json-schemas/"));
    });

    const officialPackage = join(root, ...trace.package.file.split("/"));
    it("matches the exact final dist package and reproducible assembler output", {
        skip: !existsSync(officialPackage) ? "Build the official dist package to check release-package byte identity" : false
    }, async () => {
        const bytes = readFileSync(officialPackage);
        assert.equal(sha256(bytes), trace.package.sha256, "Reassemble samples after rebuilding the final package");
        const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
        for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            assert(readFileSync(join(customRoot, ...entry.name.split("/"))).equals(await entry.async("nodebuffer")),
                `The embedded official package resource changed: ${entry.name}`);
        }
        const checked = spawnSync(process.execPath, [join(root, "scripts", "assemble-sample.mjs"), "--check"],
            { cwd: root, encoding: "utf8" });
        assert.equal(checked.status, 0, checked.stdout + checked.stderr);
        assert.match(checked.stdout, /Verified/);
    });

    it("rejects unsupported assembler flags rather than accepting arbitrary output paths", () => {
        const result = spawnSync(process.execPath, [join(root, "scripts", "assemble-sample.mjs"), "--output=elsewhere"],
            { cwd: root, encoding: "utf8" });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Usage: node scripts\/assemble-sample\.mjs/);
    });
});
