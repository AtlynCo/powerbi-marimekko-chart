# Atlyn Marimekko — authored offline sample

This is a **fully authored, locally packaged PBIP/PBIR/TMDL source sample**, with both Atlyn Marimekko instances already embedded, bound, formatted, and connected to native reconciliation tables. Set the local CSV folder and refresh; **no manual custom-visual import or field binding is required by the authored source**.

The release candidate is **1.0.1.0**, with frozen visual identity `AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472`. [PACKAGE.md](PACKAGE.md) and [assembly-manifest.json](assembly-manifest.json) identify the exact embedded package version, SHA-256, payload resources, and generated source files.

**Native validation has not been performed by this source assembly.** The owner must open, refresh, inspect, save, and reopen in Power BI Desktop and perform Service acceptance. Public-schema and source-consistency checks do not prove native custom-visual loading, TMDL/M evaluation, host interactions, accessibility, or export behavior. No binary PBIX is generated or represented as validated here.

All organizations, products, and amounts are **synthetic demonstration data**. The examples use additive revenue amounts in illustrative USD, not real market research or customer data.

## Open, set the folder, and refresh

1. Keep this entire `samples` folder together. Use a current Desktop build supporting PBIP, TMDL, and enhanced PBIR. Enable those preview options if your build requires them and restart Desktop.
2. Open `AtlynMarimekko.pbip`, or `AtlynMarimekko.Report\definition.pbir`. Both report pages and their custom/native visuals are already authored. The semantic model has no checked-in data cache.
3. In **Transform data → Manage parameters**, set `SampleDataFolder` to the absolute path of this checkout's `samples\data` directory, **without a trailing backslash**. For example: `C:\Work\powerbi-marimekko-chart\samples\data`.
   - The checked-in `C:\AtlynMarimekko\samples\data` value is an intentional placeholder, not automatic path discovery.
   - If needed, close Desktop, edit that string in `AtlynMarimekko.SemanticModel\definition\expressions.tmdl`, and reopen. M strings use literal backslashes; do not double them as if editing JSON.
   - Apply an appropriate local-source privacy level if prompted. Do not disable privacy protections or bypass your organization's custom-visual restrictions.
4. **Apply changes and refresh.** Both pages use local CSV Import partitions and explicit `SUM` measures. There is no remote source or custom-visual runtime resource fetch.
5. Reconcile the expected totals below, inspect the rendered chart/native table, and test interactions. If Desktop rejects a resource, model, or query, record the exact build/error and stop treating the report as native-validated. Reassembly is not a substitute for investigating the host error.
6. Save a working copy through Desktop. Only the owner should use Desktop's native **Save As** route if a PBIX deliverable is needed. Do not commit local `.pbi` caches/settings, credentials, or your machine-specific parameter value.

For Service use, imported demonstration data can be viewed without refreshing its local files. Scheduled refresh requires an approved accessible source/gateway; the Service cannot automatically read your developer path. A successful local source check is not a Service or publication claim.

## Authored pages

Each 1440 × 900 page contains:

- A native header with the **same PNG icon decoded from the official package**, a meaningful title, the synthetic total, and an encoding explanation.
- A bound Atlyn Marimekko at left; native role names are `segment`, `component`, and `value`.
- A native table at right using the **same grouping fields and explicit measure**.
- A reading note covering interpretation or missing/zero/narrow-column behavior.
- Chart-to-table filtering and table-to-chart highlighting authored through PBIR `visualInteractions`. Highlight behavior must still be confirmed natively.

| Page | Table | Segment role | Component role | Value role |
| --- | --- | --- | --- | --- |
| Product-region market share | `ProductRegion` | `Region` | `Product` | `[Market Revenue]` |
| Business-unit product mix | `BusinessUnitMix` | `BusinessUnit` | `Product` | `[Mix Revenue]` |

Both chart instances persist `dataContract.additiveConfirmed = true` because these synthetic measures are explicitly `SUM` over additive revenue. This is a **sample-specific author decision**, not a change to the visual's unconfirmed default. If replacing the measure with other business data, revisit the contract; do not treat this confirmation as permission to sum ratios, percentages, averages, or overlapping distinct counts.

Both instances use within-segment labels, a 48 px label threshold, 12 px font, LTR layout, and the visual's table initially collapsed. The table toggle remains available for tiny, missing, and zero-width observations. The host queries are ordered ascending by the segment and product columns; TMDL supplies their `Sort by column` mappings. No width measure is supplied.

## Product-region market share

Nine observations, three regions, three products; **1,000,000** total.

| Region (model order) | Revenue | Expected width | Atlas mix | Beacon mix | Comet mix |
| --- | ---: | ---: | ---: | ---: | ---: |
| North America | 600,000 | 60% | 60% | 30% | 10% |
| Europe | 300,000 | 30% | 40% | 40% | 20% |
| Asia Pacific | 100,000 | 10% | 20% | 30% | 50% |

Product totals: Atlas **500,000**, Beacon **330,000**, Comet **170,000**. North America/Atlas is 360,000 revenue, 60% of its region, and 36% of the overall plot area. These are shares of supplied synthetic revenue, not estimates of the external market.

## Business-unit product mix

Fifteen segment/component positions: **14 observed numbers and one missing observation**; **1,000,000** total.

| Business unit (model order) | Revenue | Expected width | Meaning |
| --- | ---: | ---: | --- |
| Enterprise | 800,000 | 80% | Atlas 50%, Beacon 37.5%, Comet 12.5% of unit |
| SMB | 150,000 | 15% | Atlas 60%, Beacon 30%, Comet 10% of unit |
| Public sector | 45,000 | 4.5% | All products observed in a smaller column |
| Incubator | 5,000 | 0.5% | Atlas 5,000; Beacon **observed zero**; Comet **missing** |
| Retired | 0 | 0% | Three measured zeros; no width; inspect in the visual's table |

Product totals: Atlas **510,000**, Beacon **365,000**, Comet **125,000**. Incubator must keep its exact mathematical width, even if its labels disappear. Retired's within-segment share is unavailable. The empty Incubator/Comet CSV field becomes M `null`, not numeric zero.

The authored native/custom grouping projections request `showAll`. Native tables can still handle blank-only combinations differently across host versions; inspect the model row and the custom visual's retained-cell table when validating that case. Do not infer an observed zero from a blank.

## Model and package structure

```text
samples\
  AtlynMarimekko.pbip
  README.md
  PACKAGE.md
  assembly-manifest.json
  data\
    product-region-market-share.csv
    business-unit-product-mix.csv
  AtlynMarimekko.Report\
    definition.pbir
    definition\                       PBIR pages, native/custom queries and interactions
    CustomVisuals\
      AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472\
        package.json                  Exact official archive manifest
        resources\
          AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472.pbiviz.json
    StaticResources\
      RegisteredResources\
        AtlynMarimekkoIcon.png         Decoded from that same package's PNG
  AtlynMarimekko.SemanticModel\
    definition.pbism
    definition\                       CSV-backed TMDL model and SampleDataFolder parameter
```

The two fact tables are independent, with no relationships. Each imports UTF-8 CSV via `Csv.Document(File.Contents(...))`, applies explicit types, converts empty revenue to null, and raises errors for invalid non-empty numeric text. Revenue/order columns are hidden; the explicit `Market Revenue` and `Mix Revenue` measures remain visible. Their names are model-wide unique, as required by [DAX measure naming](https://learn.microsoft.com/en-us/dax/dax-syntax-reference#measures). `Region → RegionOrder`, `BusinessUnit → BusinessUnitOrder`, and `Product → ProductOrder` define model sorting.

The **official SDK package is consumed, not modified**. Its `package.json` and complete type-5 `resources\…pbiviz.json` payload are extracted byte-for-byte. That JSON already contains JavaScript, CSS, icon, capabilities, and localized strings; splitting or synthesizing substitute JavaScript/CSS metadata is unnecessary. PBIR registers the payload under a `CustomVisual` resource package with a `CustomVisualMetadata` item, and each chart's `visualType` references the same GUID.

The PNG is additionally registered as an `Image` in `RegisteredResources`; native header image visuals reference it using `ResourcePackageItem`. This is not merely a `.pbiviz` copied beside an unbound canvas, and it does not masquerade as an AppSource/organizational-store visual. Runtime notices remain in the shipped visual's embedded license text and **Open-source notices** control.

Report/model JSON paths use `/` because Microsoft's format requires it. Windows file paths and Power Query paths use `\`.

## Reassemble after the final package changes

The assembler reads the current `pbiviz.json` identity/version and **only** the matching final file in `dist`. It refuses stale metadata/capabilities and never edits the `.pbiviz` archive.

From the repository root, after the owner produces the final package:

```powershell
node .\scripts\assemble-sample.mjs
node .\scripts\assemble-sample.mjs --check
node --import tsx --test .\tests\sample.test.ts
```

If dependency installation or rebuilding is needed, scope npm's environment before those commands:

```powershell
$env:NPM_CONFIG_CACHE = Join-Path (Get-Location) '.tmp\npm-cache'
npm ci
npm run package
node .\scripts\assemble-sample.mjs
```

Reassembly overwrites **generated report definitions, embedded package resources, PACKAGE.md, and assembly-manifest.json**. It does not change CSVs, TMDL, your `SampleDataFolder` parameter, or Desktop's `.pbi` local files. Keep owner-customized native work in a separate copy before regenerating. Identical package inputs produce identical generated bytes; `--check` performs no writes. Final source is tied to the exact package hash, so rebuilds require reassembly even if the version string stays the same.

The local Node tests independently inspect roles, field expressions, sample-specific confirmation, interactions, model/source references, missing/zero data, resource registration, PNG equality, and generated-file hashes. If the official `dist` file exists, they additionally compare every embedded archive file byte-for-byte and run the assembler's read-only consistency check. That final artifact comparison is explicitly skipped if the build output is absent; the checked-in source tests still run. These tests do not launch Desktop, a browser, hosted CI, or publishing tools.

## Primary format evidence and remaining acceptance

The source uses `definition.pbir` / `definition.pbism` version **4.0**, PBIR definition **2.0.0**, and TMDL compatibility level **1600**.

- [Microsoft report-folder documentation](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report): `CustomVisuals` for private visual package metadata; `StaticResources\RegisteredResources` for report-owned assets.
- [Official PBIR report schema](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/2.0.0/schema.json): `resourcePackages`, `CustomVisual`, `RegisteredResources`, `CustomVisualMetadata`, and `Image`.
- [Official visual-configuration schema](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualConfiguration/2.0.0/schema-embedded.json): `queryState`, role projections, sort metadata, and formatting objects.
- [Official semantic-query schema](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/semanticQuery/1.2.0/schema.json): `SourceRef`, `Column`, `Measure`, and `ResourcePackageItem`.
- [Official page schema](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json): `visualInteractions`, `DataFilter`, and `HighlightFilter`.
- [Microsoft SDK 7.2.1 package template](https://github.com/microsoft/PowerBI-visuals-tools/blob/v7.2.1/templates/package.json.template): the manifest's resource ID, source type 5, and payload path.
- [Microsoft's public sample image reference](https://github.com/microsoft/Analysis-Services/blob/d3ccb5032c9029b097276b88412f7b61df6e73b8/pbidevmode/fabricps-pbip/SamplePBIP/Sales.Report/report.json): native image binding to `RegisteredResources` with package type 1.
- [Public PBIR private-visual example](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/report.json): corroborates the `CustomVisualMetadata` basename registration and intact SDK package-folder layout. This is secondary implementation evidence, not Microsoft certification.
- [TMDL model-folder documentation](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset).

Official schemas describe structure, not all Desktop runtime behavior. Native acceptance must confirm that the private payload loads, both queries execute after refresh, all expected values render, selections/highlights work, and save/reopen retains the authored state. Export, accessibility, Service policy, certification, and publication remain separate owner-run gates.
