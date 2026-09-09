# Offline samples and PBIP starter

All business names and amounts here are **synthetic demonstration data**, not actual customers, company results, or market research. Both examples use additive revenue amounts in illustrative USD. They require no remote data service.

## What is included

```text
samples\
  data\
    product-region-market-share.csv
    business-unit-product-mix.csv
  AtlynMarimekko.pbip
  AtlynMarimekko.Report\
    definition.pbir
    definition\                     PBIR report, pages, native tables/instructions
  AtlynMarimekko.SemanticModel\
    definition.pbism
    definition\                     TMDL model, parameter, two imported tables
```

This is **real text-based project source**, with a local semantic-model reference, CSV-backed M partitions, additive DAX measures, Sort by column metadata, and two report pages containing native tables and instructions. It is not a renamed JSON file masquerading as a PBIX.

**Important limitation:** the project has not been opened/refreshed/saved in native Power BI Desktop in this environment. JSON/schema and source checks cannot prove TMDL loading, M evaluation, query execution, native table rendering, custom-visual import, or host compatibility. Complete the [native acceptance gates](../docs/release-checklist.md) before calling it a validated sample report.

There is deliberately **no embedded custom-visual package**, `CustomVisuals` metadata, or claimed AppSource visual reference. Add the actual `.pbiviz` through Desktop so the host writes valid private-visual resource metadata. The blank left side of each page is reserved for it; the right-hand native table provides a reconciliation baseline.

## Open in Power BI Desktop

1. Keep the entire `samples` directory structure together. Use current Power BI Desktop with **Power BI Project (.pbip)**, **TMDL semantic model**, and **enhanced report format (PBIR)** support. Enable relevant preview options under **File → Options and settings → Options → Preview features** if your build requires them; restart Desktop.
2. Open `AtlynMarimekko.pbip`. Alternatively, open `AtlynMarimekko.Report\definition.pbir`. The model initially has no cached imported data.
3. In **Transform data → Manage parameters**, change `SampleDataFolder` to the absolute path of this checkout's `samples\data` folder, **without a trailing backslash**, for example `C:\Work\powerbi-marimekko-chart\samples\data`.
   - The checked-in value `C:\AtlynMarimekko\samples\data` is an intentional portable placeholder, not an automatically resolved repository path.
   - If you cannot reach the parameter UI, close Desktop and edit the string in `AtlynMarimekko.SemanticModel\definition\expressions.tmdl`, then reopen.
   - M uses literal backslashes in strings; do not double them as if this were JSON.
4. Apply changes and refresh. If prompted for a local source's privacy level, choose the level appropriate to your environment; do not disable privacy protections. Both sources are local files under this folder.
5. Verify native table values and the expected totals below. The measure `[Revenue Amount]` is `SUM` over the table's `Revenue` column. Revenue columns are hidden to encourage explicit measure binding; order columns are hidden but used for sorting.
6. Import `dist\AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472.1.0.0.0.pbiviz` from the repository root using **Visualizations → … → Import a visual from a file**.
7. Add Atlyn Marimekko on the left side of each page (approximately X=24, Y=160, width=752, height=520). Bind:

   | Page | Segment | Component | Additive value |
   | --- | --- | --- | --- |
   | Product-region market share | `ProductRegion[Region]` | `ProductRegion[Product]` | `ProductRegion[Revenue Amount]` |
   | Business-unit product mix | `BusinessUnitMix[BusinessUnit]` | `BusinessUnitMix[Product]` | `BusinessUnitMix[Revenue Amount]` |

8. Confirm the values are additive, then enable **Format → Data contract → Value is additive, not a ratio or distinct count** on each instance. Do not bind calculated share measures or a second “width” measure.
9. Set the host visual's segment sort ascending to follow the model order. Check the model's **Sort by column** definitions: `Region → RegionOrder`, `BusinessUnit → BusinessUnitOrder`, and each `Product → ProductOrder`. Component order follows what the host supplies.
10. Open the custom visual's accessible table and compare to the native table, particularly the Incubator blank and Retired zeros. Use **Edit interactions** to test selection/highlighting between visuals on the same page.
11. Save your customized project or use **Save As → Power BI report (.pbix)** in Desktop if a native binary deliverable is required. Reopen and verify that actual saved report; this repository does not supply or claim to have generated a PBIX.

Changing the path and refreshing are one-time setup, not a runtime web dependency. Do not commit your machine-specific parameter value, `.pbi` caches, local settings, or credentials.

## Example 1: product-region market share

Nine observations, three regions, three products; total **1,000,000**.

| Region (model order) | Total | Expected width | Atlas mix | Beacon mix | Comet mix |
| --- | ---: | ---: | ---: | ---: | ---: |
| North America | 600,000 | 60% | 60% | 30% | 10% |
| Europe | 300,000 | 30% | 40% | 40% | 20% |
| Asia Pacific | 100,000 | 10% | 20% | 30% | 50% |

Expected product totals are Atlas **500,000**, Beacon **330,000**, and Comet **170,000**. For example, North America/Atlas has raw revenue 360,000, segment share 60%, and overall area/share 36%.

The narrative is “product revenue share within and across supplied regional markets,” not a measured share of the external market. Each region's supplied revenue is its width basis.

## Example 2: business-unit product mix

Fifteen segment/component positions, five units, three products; **14 observed numbers and one missing observation**; total **1,000,000**.

| Business unit (model order) | Total | Expected width | Notes |
| --- | ---: | ---: | --- |
| Enterprise | 800,000 | 80% | Atlas 50%, Beacon 37.5%, Comet 12.5% of unit |
| SMB | 150,000 | 15% | Atlas 60%, Beacon 30%, Comet 10% of unit |
| Public sector | 45,000 | 4.5% | Smaller column, all three products observed |
| Incubator | 5,000 | 0.5% | Atlas 5,000; Beacon **observed 0**; Comet **missing** |
| Retired | 0 | 0% | Three observed zeros; no column width; discoverable in table |

Expected product totals are Atlas **510,000**, Beacon **365,000**, and Comet **125,000**. At ordinary canvas sizes Incubator's labels should disappear rather than making the column wider. Retired has no positive geometry; within-segment percentages are unavailable. Incubator/Comet's empty CSV value is converted to M `null`, not numeric zero.

Power BI native visuals may suppress blank-only rows depending on their settings. The provided native table requests `showAll`; if the blank combination is absent in your Desktop build, enable **Show items with no data** for the grouping fields and inspect the model row. The custom visual's retained grid/table must distinguish the missing observation from Beacon's zero.

## Model details

- Two independent fact tables; intentionally no relationships or hidden cross-table filtering assumptions.
- Import-mode partitions use `Csv.Document(File.Contents(...))`, UTF-8, headers, explicit numeric/order types, and empty-revenue-to-null conversion.
- Non-empty invalid revenue text raises an M conversion error; sample import does not replace errors with zero.
- One explicit `SUM` measure per table; currency formatting is illustrative USD, not a percent.
- `SampleDataFolder` is a Power Query text parameter. Its absolute local path must be set by the opener; PBIP relative report/model references do not make `File.Contents` paths relative.
- No cached `.abf`, credentials, live Service connection, external dataset, or fabricated report binary is included.
- The report's native tables bind directly to these entities/measures. No visual API host mock is involved in the project source.

The `.pbip` and `.pbir` references use `/` in serialized JSON paths because Microsoft's project schemas require it; Windows filesystem and Power Query paths use `\`.

## If your Desktop build cannot open the source

Do not treat the failure as a successful native validation. Record the exact build, error, and offending file. First confirm the relevant PBIP/TMDL/PBIR features and use a supported current build. Keep a copy before letting Desktop upgrade source formats.

A fully native fallback is:

1. Create a blank report. Use **Get data → Text/CSV** for each local CSV and choose **Transform data**.
2. Name the queries `ProductRegion` and `BusinessUnitMix`. Set grouping fields to Text, order fields to Whole Number, and Revenue to a numeric type. Keep the empty Comet revenue null. The checked-in TMDL partitions contain the equivalent M steps for reference.
3. Create `Revenue Amount = SUM(ProductRegion[Revenue])` in `ProductRegion`, and `Revenue Amount = SUM(BusinessUnitMix[Revenue])` in `BusinessUnitMix`. Apply currency formatting and the Sort by column mappings above.
4. Build a native table on each page, import/bind the `.pbiviz`, confirm additivity, and reconcile the expected values.
5. Save the real report as PBIP or PBIX and perform native acceptance. This is a documented rebuild route, not evidence that the checked-in starter opened successfully.

For Service publishing, imported demonstration data can be viewed without refreshing from the source. Scheduled refresh of local files requires an appropriately configured gateway/approved accessible source; it does not work automatically from your developer path.

## Source format references

The starter targets `definition.pbir` version **4.0**, `definition.pbism` version **4.0**, PBIR definition version **2.0.0**, and a TMDL model at compatibility level **1600**. Files use Microsoft's public `$schema` references; native Desktop compatibility remains to be verified.

- [Power BI projects overview](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-overview)
- [Report folder and PBIR](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)
- [Semantic model folder and TMDL](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset)
- [TMDL syntax and folder structure](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview)
- [Official Microsoft Fabric JSON schemas](https://github.com/microsoft/json-schemas/tree/main/fabric)

No report format source check, browser test, or public schema substitutes for opening, refreshing, rendering, saving, and reopening in native Power BI.
