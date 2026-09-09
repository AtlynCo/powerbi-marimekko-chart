import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sample = join(root, "samples");
const reportFolder = "AtlynMarimekko.Report";
const frozenGuid = "AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472";
const schemaRoot = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition";
const schema = (kind, version = "2.0.0") => `${schemaRoot}/${kind}/${version}/schema.json`;
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === "--check"),
    "Usage: node scripts/assemble-sample.mjs [--check]");
const check = args[0] === "--check";
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const readJson = file => JSON.parse(readFileSync(file, "utf8"));
const files = new Map();
const emit = (path, content) => files.set(path, Buffer.isBuffer(content) ? content : json(content));
const emitReport = (path, content) => emit(`${reportFolder}/${path}`, content);
const literal = value => ({ expr: { Literal: {
    Value: typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : String(value)
} } });
const formatting = properties => [{ properties }];
const field = (entity, property, measure = false) => ({
    [measure ? "Measure" : "Column"]: { Expression: { SourceRef: { Entity: entity } }, Property: property }
});
const projection = (entity, property, measure = false) => ({
    field: field(entity, property, measure), queryRef: `${entity}.${property}`, nativeQueryRef: property
});
const container = (name, visual, position) => ({
    $schema: schema("visualContainer"), name, position, visual
});
const position = (x, y, width, height, tabOrder) => ({ x, y, z: tabOrder, width, height, tabOrder });
const title = (text, altText) => ({
    title: formatting({ show: literal(true), text: literal(text) }),
    general: formatting({ altText: literal(altText) })
});
const sources = {
    reportFolder: "https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report",
    reportResources: `${schema("report")}#/definitions/ResourcePackage`,
    reportResourceItems: `${schema("report")}#/definitions/ResourcePackageItem`,
    visualQuery: `${schemaRoot}/visualConfiguration/2.0.0/schema-embedded.json#/definitions/Query`,
    fieldExpressions: `${schemaRoot}/semanticQuery/1.2.0/schema.json#/definitions/QueryExpressionContainer`,
    sdkPackageTemplate: "https://github.com/microsoft/PowerBI-visuals-tools/blob/v7.2.1/templates/package.json.template",
    microsoftImageReference: "https://github.com/microsoft/Analysis-Services/blob/d3ccb5032c9029b097276b88412f7b61df6e73b8/pbidevmode/fabricps-pbip/SamplePBIP/Sales.Report/report.json",
    publicPrivateVisualExample: "https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/report.json"
};

const sourceMetadata = readJson(join(root, "pbiviz.json"));
assert.equal(sourceMetadata.visual.guid, frozenGuid, "The visual GUID is frozen");
assert.match(sourceMetadata.visual.version, /^\d+\.\d+\.\d+\.\d+$/);
const packageName = `${frozenGuid}.${sourceMetadata.visual.version}.pbiviz`;
const packageFile = join(root, "dist", packageName);
assert(existsSync(packageFile), `Missing final package: ${packageName}. Run npm run package first.`);
const packageBytes = readFileSync(packageFile);
const packageHash = hash(packageBytes);
const archive = await JSZip.loadAsync(packageBytes, { checkCRC32: true });
const manifestEntry = archive.file("package.json");
assert(manifestEntry, "Official SDK package.json is required");
const manifest = JSON.parse(await manifestEntry.async("string"));
assert.deepEqual(manifest.visual, sourceMetadata.visual, "Package metadata is stale; rebuild the final package");
assert.equal(manifest.version, sourceMetadata.visual.version);
const metadataResource = manifest.resources.find(resource => resource.resourceId === manifest.metadata?.pbivizjson?.resourceId);
assert.equal(metadataResource?.sourceType, 5, "Expected the official SDK JSON-payload resource");
const metadataEntry = archive.file(metadataResource.file);
assert(metadataEntry, "Package metadata resource does not resolve");
const payloadBytes = await metadataEntry.async("nodebuffer");
const payload = JSON.parse(payloadBytes.toString("utf8"));
assert.deepEqual(payload.visual, sourceMetadata.visual);
assert.equal(payload.apiVersion, sourceMetadata.apiVersion);
assert.deepEqual(payload.capabilities, readJson(join(root, "capabilities.json")),
    "Package capabilities are stale; rebuild the final package");
assert.deepEqual(payload.capabilities.privileges, []);
assert.deepEqual(payload.externalJS, []);
assert.equal(typeof payload.content?.js, "string");
assert.equal(typeof payload.content?.css, "string");
assert(payload.content.js.length > 0 && payload.content.css.length > 0);
assert(payload.stringResources?.["en-US"] && payload.stringResources?.["fr-FR"],
    "Package all locales before assembling the sample");
const iconMatch = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(payload.content.iconBase64);
assert(iconMatch, "A PNG icon embedded in the official payload is required");
const icon = Buffer.from(iconMatch[1], "base64");
assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");

// Keep the official manifest and full type-5 payload intact: JS, CSS, icon and locales live inside it.
const archiveNames = new Set();
for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue;
    assert(!entry.unsafeOriginalName || entry.unsafeOriginalName === entry.name, "Unsafe archive path");
    assert(!entry.name.includes("\\") && !entry.name.includes(":") && !entry.name.startsWith("/") &&
        entry.name.split("/").every(part => part !== "" && part !== "." && part !== ".."), "Unsafe archive path");
    assert(!archiveNames.has(entry.name.toLowerCase()), "Case-insensitive duplicate archive path");
    archiveNames.add(entry.name.toLowerCase());
    assert((Number(entry.unixPermissions) & 0o170000) !== 0o120000, "Archive symlinks are unsupported");
    emitReport(`CustomVisuals/${frozenGuid}/${entry.name}`, await entry.async("nodebuffer"));
}
const iconName = "AtlynMarimekkoIcon.png";
emitReport(`StaticResources/RegisteredResources/${iconName}`, icon);

emitReport("definition/report.json", {
    $schema: schema("report"),
    themeCollection: {},
    resourcePackages: [
        {
            name: frozenGuid, type: "CustomVisual",
            items: [{ name: basename(metadataResource.file), path: basename(metadataResource.file), type: "CustomVisualMetadata" }]
        },
        {
            name: "RegisteredResources", type: "RegisteredResources",
            items: [{ name: iconName, path: iconName, type: "Image" }]
        }
    ],
    settings: { useStylableVisualContainerHeader: true },
    annotations: [
        { name: "AtlynSampleStatus", value: "Provisional native-retry sample with self-contained inline M data. Native refresh/render validation pending; rendering-only package, not final paid build." },
        { name: "AtlynPackageVersion", value: manifest.version },
        { name: "AtlynPackageSha256", value: packageHash }
    ]
});
emitReport("definition/version.json", { $schema: schema("versionMetadata", "1.0.0"), version: "2.0.0" });
emitReport("definition/pages/pages.json", {
    $schema: schema("pagesMetadata", "1.0.0"), pageOrder: ["MarketShare", "ProductMix"], activePageName: "MarketShare"
});

const pages = [
    {
        name: "MarketShare", prefix: "Market", displayName: "Product-region market share",
        entity: "ProductRegion", segment: "Region", measure: "Market Revenue",
        heading: "Product-region market share",
        subtitle: "Synthetic revenue · $1,000,000 total · North America 60% / Europe 30% / Asia Pacific 10%",
        interpretation: "Read both size and mix: North America / Atlas is $360,000, 60% of its region and 36% of the total. Select a cell or a table row to compare the same revenue across both views."
    },
    {
        name: "ProductMix", prefix: "Mix", displayName: "Business-unit product mix",
        entity: "BusinessUnitMix", segment: "BusinessUnit", measure: "Mix Revenue",
        heading: "Business-unit product mix",
        subtitle: "Synthetic revenue · $1,000,000 total · Enterprise 80% / SMB 15% / Public sector 4.5% / Incubator 0.5%",
        interpretation: "Incubator keeps its exact 0.5% width. Retired has measured zeros and no width. Incubator / Comet is missing, not zero; open the visual's data table to inspect every retained cell."
    }
];
for (const page of pages) {
    const tableDefinition = readFileSync(join(sample, "AtlynMarimekko.SemanticModel", "definition", "tables", `${page.entity}.tmdl`), "utf8");
    assert(tableDefinition.includes(`measure '${page.measure}' = SUM(${page.entity}[Revenue])`),
        `The authored sample requires its explicit additive ${page.measure} measure`);
    const chartName = `${page.prefix}Marimekko`;
    const tableName = `${page.prefix}Baseline`;
    const path = `definition/pages/${page.name}`;
    const emitVisual = (name, visual, bounds) => emitReport(`${path}/visuals/${name}/visual.json`, container(name, visual, bounds));
    emitReport(`${path}/page.json`, {
        $schema: schema("page"), name: page.name, displayName: page.displayName,
        displayOption: "FitToPage", width: 1440, height: 900,
        visualInteractions: [
            { source: chartName, target: tableName, type: "DataFilter" },
            { source: tableName, target: chartName, type: "HighlightFilter" }
        ]
    });
    emitVisual(`${page.prefix}Icon`, {
        visualType: "image",
        objects: { general: formatting({ imageUrl: { expr: {
            ResourcePackageItem: { PackageName: "RegisteredResources", PackageType: 1, ItemName: iconName }
        } } }) },
        visualContainerObjects: { general: formatting({ altText: literal("Atlyn Marimekko") }) }
    }, position(24, 25, 40, 40, 0));
    emitVisual(`${page.prefix}Instructions`, {
        visualType: "textbox",
        objects: { general: formatting({ paragraphs: [
            { textRuns: [{ value: page.heading, textStyle: { fontSize: "24pt", fontWeight: "bold", color: "#172B3A" } }] },
            { textRuns: [{ value: page.subtitle, textStyle: { fontSize: "12pt", color: "#374151" } }] },
            { textRuns: [{ value: "Width = segment share  •  Height = within-segment mix  •  Area = overall contribution",
                textStyle: { fontSize: "12pt", color: "#374151" } }] }
        ] }) }
    }, position(80, 16, 1336, 128, 1));
    const sortDefinition = { sort: [
        { field: field(page.entity, page.segment), direction: "Ascending" },
        { field: field(page.entity, "Product"), direction: "Ascending" }
    ], isDefaultSort: false };
    emitVisual(chartName, {
        visualType: frozenGuid,
        query: {
            queryState: {
                segment: { showAll: true, projections: [projection(page.entity, page.segment)] },
                component: { showAll: true, projections: [projection(page.entity, "Product")] },
                value: { projections: [projection(page.entity, page.measure, true)] }
            },
            sortDefinition
        },
        objects: {
            dataContract: formatting({ additiveConfirmed: literal(true) }),
            appearance: formatting({
                showLabels: literal(true), labelContent: literal("segmentShare"),
                minLabelWidth: literal(48), fontSize: literal(12), direction: literal("ltr"), showTable: literal(false)
            })
        },
        visualContainerObjects: title("Revenue size and composition",
            `${page.heading}. Width is segment revenue share, height is product mix, and area is overall contribution. Synthetic additive SUM measure. Use the visual's data table for tiny, zero, and missing cells.`)
    }, position(24, 160, 930, 620, 2));
    emitVisual(tableName, {
        visualType: "tableEx",
        query: {
            queryState: { Values: { showAll: true, projections: [
                projection(page.entity, page.segment), projection(page.entity, "Product"), projection(page.entity, page.measure, true)
            ] } },
            sortDefinition
        },
        visualContainerObjects: title("Reconcile revenue · USD",
            `Native table: ${page.segment}, Product, and the same ${page.measure} SUM measure as the Marimekko. Select rows to highlight the chart.`)
    }, position(978, 160, 438, 620, 3));
    emitVisual(`${page.prefix}Interpretation`, {
        visualType: "textbox",
        objects: { general: formatting({ paragraphs: [
            { textRuns: [{ value: page.interpretation, textStyle: { fontSize: "12pt", color: "#172B3A" } }] },
            { textRuns: [{ value: `Atlyn Marimekko ${manifest.version} · Synthetic offline sample · Source authored; native Desktop/Service acceptance pending`,
                textStyle: { fontSize: "10pt", color: "#4B5563" } }] }
        ] }) }
    }, position(24, 800, 1392, 84, 4));
}

const generatedFiles = [...files].map(([path, bytes]) => ({ path, sha256: hash(bytes), bytes: bytes.length }));
const trace = {
    formatVersion: 1,
    visual: { guid: frozenGuid, name: manifest.visual.name, version: manifest.version, apiVersion: payload.apiVersion },
    package: { file: `dist/${packageName}`, sha256: packageHash, bytes: packageBytes.length, modified: false },
    embedding: {
        type: "CustomVisualMetadata", root: `${reportFolder}/CustomVisuals/${frozenGuid}`,
        metadataResource: metadataResource.file, javascriptSha256: hash(payload.content.js),
        cssSha256: hash(payload.content.css), iconSha256: hash(icon), locales: Object.keys(payload.stringResources).sort()
    },
    pages: pages.map(page => ({
        name: page.name, visualName: `${page.prefix}Marimekko`, entity: page.entity,
        bindings: { segment: page.segment, component: "Product", value: page.measure }, additiveConfirmed: true
    })),
    nativeValidation: { desktop: "pending-owner-validation", service: "pending-owner-validation", pbixGenerated: false },
    sources,
    generatedFiles
};
emit("assembly-manifest.json", trace);
emit("PACKAGE.md", Buffer.from(`# Embedded package provenance\n\n` +
    `Generated by \`node scripts\\assemble-sample.mjs\`. Do not edit; regenerate after the final package changes.\n\n` +
    `- Visual: \`${frozenGuid}\`\n- Version: **${manifest.version}**\n- API: **${payload.apiVersion}**\n` +
    `- Source package: \`dist\\${packageName}\`\n- SHA-256: \`${packageHash}\`\n` +
    `- Official package bytes consumed without archive modification: **${packageBytes.length}**\n` +
    `- Embedded localization: ${Object.keys(payload.stringResources).sort().join(", ")}\n\n` +
    `The official SDK manifest and complete JSON payload are extracted unchanged under the report's \`CustomVisuals\\${frozenGuid}\` folder. ` +
    `PBIR registers the payload as \`CustomVisualMetadata\`; its embedded content supplies JavaScript, CSS, PNG icon, capabilities and localized resources. ` +
    `The same packaged PNG is also registered as an image for both authored page headers. ` +
    `Both chart instances bind the native \`segment\`, \`component\` and \`value\` roles and confirm the synthetic additive SUM measure.\n\n` +
    `See [assembly-manifest.json](assembly-manifest.json) for per-file hashes and source references. ` +
    `The assembly command and consistency checks are local/offline; they do not invoke Power BI, a browser, hosted CI or publication APIs.\n\n` +
    `**Native status: provisional correction awaiting owner retry.** The source uses inline M literal data, with no external file connection or folder parameter. The owner must open, refresh, inspect and save in Desktop; Service acceptance is also pending. ` +
    `The embedded package remains sealed rendering-only evidence without paid entitlement integration, not a final paid or submission build. ` +
    `No binary PBIX is generated or claimed. Package and source checks are not native-host evidence.\n`, "utf8"));

// Validate all intended bytes before the first write; --check never modifies authored or local Desktop files.
for (const [path, bytes] of files) {
    const destination = join(sample, ...path.split("/"));
    if (check) {
        assert(existsSync(destination) && readFileSync(destination).equals(bytes),
            `Sample is missing or stale: ${path}. Run node scripts/assemble-sample.mjs after npm run package.`);
    }
}
if (!check) {
    for (const [path, bytes] of files) {
        const destination = join(sample, ...path.split("/"));
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, bytes);
    }
}
console.log(`${check ? "Verified" : "Assembled"} ${files.size} sample files from ${packageName} (SHA-256 ${packageHash}). Native validation pending.`);
