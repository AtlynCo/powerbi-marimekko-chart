# Authoring and accessibility guide

## Install, bind, and confirm

1. Use a Power BI Desktop version that supports the visual's API (`5.11.0` in `pbiviz.json`). Native version compatibility must be verified on the release checklist; no minimum tested Desktop build is asserted here.
2. Import the approved `.pbiviz` using **Visualizations → … → Import a visual from a file**. Depending on Desktop's UI, visual management may be exposed through the insert/on-object menus. Follow your tenant's policy for uncertified custom visuals.
3. Add a visual instance. Bind one grouping column to **Segment**, one to **Component**, and one additive numeric measure to **Additive value**.
4. Confirm that summing the measure across both fields makes sense. Enable **Format → Data contract → Value is additive, not a ratio or distinct count**. Save the report to retain this author setting.
5. Add a native table with the same two fields and measure. Reconcile totals and any completeness warning before presenting the result.

For the sample pages:

| Page/table | Segment | Component | Additive value |
| --- | --- | --- | --- |
| Product-region market share / `ProductRegion` | `Region` | `Product` | `[Revenue Amount]` |
| Business-unit product mix / `BusinessUnitMix` | `BusinessUnit` | `Product` | `[Revenue Amount]` |

Do not combine fields from these two unrelated sample tables. There are intentionally no relationships between them. Use the explicit measure, not a count of the revenue column.

Set **Sort by column** for segment/product columns to their corresponding order columns. The starter already defines these model properties. Set the host visual's segment sort ascending when inspecting the supplied order. The visual preserves the order received; if Power BI sorts differently, correct the host sort rather than expecting the visual to override it.

## Formatting

| Card/property | Default | Behavior |
| --- | --- | --- |
| Data contract / `dataContract.additiveConfirmed` | `false` | Explicit author confirmation of additivity; mandatory for geometry. |
| Presentation / `appearance.showLabels` | `true` | Show labels only where they fit. |
| `appearance.labelContent` | `segmentShare` | `segmentShare`: within-segment share; `raw`: model-formatted value; `overallShare`: overall or displayed-subset share. |
| `appearance.minLabelWidth` | `48` px | Label eligibility threshold, 16–300 px. Never expands a column. |
| `appearance.fontSize` | `12` px | Label/text size setting, 10–24 px. |
| `appearance.direction` | `auto` | `auto`, `ltr`, or `rtl`; use RTL explicitly for layout testing. |
| `appearance.showTable` | `false` | Show the accessible table initially. Its in-visual toggle is always available. |

English and French UI strings follow the host locale. Other locales fall back to English UI strings; raw values still use their model format and host locale where supported. RTL layout is supported independently of whether a UI translation exists. Model names, user data, and author text are not translated.

Dimensional display labels have a 2,048-character limit (JavaScript string units). Prefer concise model labels; truncation does not change selection identities or values. Component colors are deterministic hashes of native series keys into the visual's own palette, not report-theme colors outside high contrast.

## Selecting and exploring data

- Select a rectangle to select a **cell**; use the table's segment/component/cell controls and component legend for observations too small to target.
- Select a legend item for a **component**. Table segment controls select a **segment**. These use SDK category/series/cell identities, not fabricated strings.
- Hold **Ctrl** or **Cmd** while selecting to add to the current selection. Cross-filter/highlight behavior in other visuals also depends on the report's **Edit interactions** settings.
- Use **Escape** to clear selection. Right-click a selectable mark/control, or use **Shift+F10**, for the host context menu.
- Hover a cell to inspect model-formatted raw value, segment share, and overall/displayed-subset share. When highlights exist, inspect highlighted values relative to base totals. Hover is not the only way to access the data: use the table.

## Keyboard, contrast, and reading order

1. Navigate into the visual using Power BI's keyboard navigation. Host entry/exit behavior must be checked in native Desktop and Service.
2. Tab through the legend, table toggle, and other controls. On a chart cell, use **arrow keys** to move among drawable cells, **Home/End** for the first/last drawable cell, and **Enter/Space** to select. Ctrl/Cmd modifies selection.
3. Open the accessible table to inspect all retained cells, including tiny columns, zeros, and missing values. The table uses **100 rows per page**; use Previous/Next controls. Tab and activate buttons with Enter/Space.
4. Turn on OS/host high contrast and verify host colors, borders/patterns, focus outlines, selection, and legibility. Do not rely on component color as the only identifier.
5. Test with a screen reader, keyboard only, browser zoom, narrow visual sizes, and both LTR/RTL. The visual does not animate transitions.

The **Open-source notices** button opens bundled dependency license text without a network request. It is separate from the accessible data table and does not change the chart's data or selection.

The implementation includes accessibility affordances; this is **not a WCAG conformance statement or proof of Power BI screen-reader integration**. Author meaningful report titles/alt text and complete the [manual acceptance checklist](release-checklist.md).

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Binding prompt or no chart | All three roles must have exactly one valid field; value must be numeric. |
| Additivity warning | Verify measure semantics, then enable the Data contract toggle. Do not confirm to bypass a known ratio. |
| Percentage measure blocked after confirmation | Bind underlying additive amounts, not formatted/precomputed percentages. Simply changing format does not make a ratio additive. |
| Negative/invalid-value warning | Inspect the table/model. Correct inputs; do not drop offending values to make the chart render. |
| Blank versus zero looks different | Missing is not measured zero; see the [contract](data-contract.md). |
| All-blank data reports missing/empty | Expected: missing observations are not an observed all-zero dataset. |
| Table has raw values/status but totals or shares are unavailable | Resolve invalid data, missing additivity confirmation, unsupported percentage input, identity problems, or numeric-range diagnostics. Rejected input must not show trusted-looking derived composition. |
| No geometry but valid table | All-zero or missing total; zero-total segments have no width by design. |
| Labels disappear | Widen the visual or reduce font/label threshold. Use the table; exact column widths are not enlarged. |
| Displayed-subset warning persists | Filter/aggregate below all three bounds; host reduction may also affect component totals. Never report subset shares as full totals. |
| Selection does not affect another visual | Check report interactions, compatible model fields, and host identities. Reproduce in native Power BI, not only in browser mocks. |
| PBIP refresh cannot find CSV files | Set the absolute `SampleDataFolder` parameter as described in [samples](../samples/README.md). |
| Import, publish, or export is blocked | Check organization policy and host support for uncertified visuals. Do not bypass policy. |

Report issues through the [support process](privacy-and-support.md), including a minimal nonsensitive reproduction and the precise Desktop/Service version.
