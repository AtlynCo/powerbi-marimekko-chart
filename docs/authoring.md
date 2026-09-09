# Authoring and accessibility guide

## Install, bind, and confirm

1. Use a Power BI Desktop version that supports the visual's API (`5.11.0` in `pbiviz.json`, exported by API package `5.11.1`). Native version compatibility must be verified on the release checklist; no minimum tested Desktop build is asserted here.
2. Import the approved `.pbiviz` using **Visualizations → … → Import a visual from a file**. Depending on Desktop's UI, visual management may be exposed through the insert/on-object menus. Follow your tenant's policy for uncertified custom visuals.
3. Add a visual instance. Bind one grouping column to **Segment**, one to **Component**, and one additive numeric measure to **Additive value**.
4. Confirm that summing the measure across both fields makes sense. Enable **Format → Data contract → Value is additive, not a ratio or distinct count**. Save the report to retain this author setting.
5. Add a native table with the same two fields and measure. Reconcile totals and any completeness warning before presenting the result.

For the sample pages:

| Page/table | Segment | Component | Additive value |
| --- | --- | --- | --- |
| Product-region market share / `ProductRegion` | `Region` | `Product` | `[Market Revenue]` |
| Business-unit product mix / `BusinessUnitMix` | `BusinessUnit` | `Product` | `[Mix Revenue]` |

Do not combine fields from these two unrelated sample tables. There are intentionally no relationships between them. Use the explicit measure, not a count of the revenue column.

Set **Sort by column** for segment/product columns to their corresponding order columns. The bound sample already defines these model properties. Set the host visual's segment sort ascending when inspecting the supplied order. The visual preserves the order received; if Power BI sorts differently, correct the host sort rather than expecting the visual to override it.

## Formatting

| Card/property | Default | Behavior |
| --- | --- | --- |
| Data contract / `dataContract.additiveConfirmed` | `false` | Explicit author confirmation of additivity; mandatory for geometry. |
| Presentation / `appearance.showLabels` | `true` | Show labels only where they fit. |
| `appearance.labelContent` | `segmentShare` | `segmentShare`: within-segment share; `raw`: model-formatted value; `overallShare`: overall or displayed-subset share. |
| `appearance.minLabelWidth` | `48` px | Label eligibility threshold, 16–300 px. Never expands a column. |
| `appearance.fontSize` | `12` px | Label/text size setting, 10–24 px. |
| `appearance.direction` | `auto` | `auto`, `ltr`, or `rtl`; use RTL explicitly for layout testing. |
| `appearance.showTable` | `false` | Show the accessible table. The in-visual Data toggle persists this property through the host, including report/bookmark restoration. |

English and French UI strings follow the host locale. Other locales fall back to English UI strings; raw values still use their model format and host locale where supported. RTL layout is supported independently of whether a UI translation exists. Model names, user data, and author text are not translated.

Dimensional display labels have a 2,048-character limit (JavaScript string units). Prefer concise model labels; truncation does not change selection identities or values. Component colors are deterministic hashes of native series keys into the visual's own palette, not report-theme colors outside high contrast.

## Selecting and exploring data

- Select a rectangle to select a **cell**; use the table's segment/component/cell controls and component legend for observations too small to target.
- Select a legend item for a **component**. Segment headers and table segment controls select a **segment**. These use SDK category/series/cell identities, not fabricated strings.
- Hold **Ctrl** or **Cmd** while selecting to add to the current selection. Cross-filter/highlight behavior in other visuals also depends on the report's **Edit interactions** settings.
- Use **Escape** to clear selection. Right-click a selectable mark/control, or use **Shift+F10**, for the host context menu.
- Hover or focus a cell to inspect model-formatted raw value, segment share, and overall/displayed-subset share. Segment and legend controls also expose native tooltips with their totals and denominator meaning. When highlights exist, inspect highlighted values relative to base totals. Hover is not the only way to access the data: use the table.

## Keyboard, contrast, and reading order

1. Navigate into the visual using Power BI's keyboard navigation. Host entry/exit behavior must be checked in native Desktop and Service.
2. Tab through the legend, table toggle, and other controls. On a chart cell, use **arrow keys** to move among drawable cells, **Home/End** for the first/last drawable cell, and **Enter/Space** to select. Ctrl/Cmd modifies selection.
3. Open the accessible table to inspect all retained cells, including tiny columns, zeros, and missing values. The table uses **100 rows per page**; use Previous/Next controls. In compact layouts the pager scrolls with the table; scroll back to its top or navigate by keyboard to change pages. Tab and activate buttons with Enter/Space.
4. Turn on OS/host high contrast and verify host colors, borders/patterns, focus outlines, selection, and legibility. Do not rely on component color as the only identifier.
5. Test with a screen reader, keyboard only, browser zoom, narrow visual sizes, and both LTR/RTL. The visual does not animate transitions.

Open **Info**, then **Open-source notices**, to read bundled dependency license text without a network request. It is separate from the accessible data table and does not change the chart's data or selection.

The implementation includes accessibility affordances; this is **not a WCAG conformance statement or proof of Power BI screen-reader integration**. Author meaningful report titles/alt text and complete the [manual acceptance checklist](release-checklist.md).

## Dashboard sizing and interpretation

The legend uses component names, current legend numbers, and each component's share of the overall (or explicitly displayed-subset) total. Numbers are lookup aids, not immutable category identifiers. Component color is stable by native series identity; palette collisions are possible, so names, numbers and the table remain important.

Segment footers state the width share and, when space permits, the model-formatted segment total. Cell labels show the component name plus the chosen value when both fit; smaller eligible cells use a legend number plus value. Collision measurements suppress labels, never resize a quantitative mark.

Below 440 pixels wide or 340 pixels tall, compact controls and shorter visible diagnostics preserve room for the plot. **Info** retains the complete encoding explanation and diagnostics. Opening **Data** replaces the chart in compact mode and shares available height in larger layouts. The Clear button appears when there is a selection. Below 180 pixels wide or 140 pixels tall, or when less than 120 by 32 plot pixels remain, the visual explicitly asks for more space instead of inventing a readable chart. These limits are not native-host compatibility guarantees.

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
| PBIP asks for a CSV folder or fails at an indented `ref table` | Use the provisional corrected [sample](../samples/README.md), not the original sealed sample. It uses document-scope references and inline M data with no folder parameter. |
| Import, publish, or export is blocked | Check organization policy and host support for uncertified visuals. Do not bypass policy. |

Report issues through the [support process](privacy-and-support.md), including a minimal nonsensitive reproduction and the precise Desktop/Service version.
