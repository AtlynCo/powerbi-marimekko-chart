# Release-quality review: 1.0.1.0

This is an internal engineering comparison and evidence plan, reviewed against primary documentation on **2026-09-09**. It is not comparative marketing, a benchmark of other products, or a "best-in-class" assertion. No competitor package was installed or measured.

## Composition workflow comparison

| Workflow | Primary documented behavior | Atlyn's narrower choice and tradeoff |
| --- | --- | --- |
| Inforiver Analytics+ Marimekko | Independent height/width inputs; absolute/percentage/stacked options and richer orientations, labels, trellis/ranking/conditional formatting. | One additive measure derives width and height together. This makes area meaning explicit but does not replace those variants or authoring features. |
| Inforiver legend | Rich legend controls including include/exclude behavior. | Native series selection and totals/shares in legend tooltips. No local include/exclude state that silently changes the denominator. |
| Native 100% stacked columns | Within-category percentage composition, familiar native formatting and interactions. | Variable widths additionally encode category contribution. Equal-width columns can be simpler for comparing composition alone. Native integration is not a property our mock tests establish. |
| Native treemap | Nested area/hierarchy comparison. | Separate segment widths and component heights expose both denominators. Treemap remains an appropriate native area/hierarchy alternative. |
| Deneb / Vega / Vega-Lite | Custom specifications and transformations can describe mosaics; Power BI selection/tooltip behavior requires deliberate identity/interactivity setup. | Fixed field wells, additivity confirmation, bounded denominators and table access need no chart specification. Deneb remains much more flexible. |

Sources: [Inforiver Marimekko documentation](https://docs.inforiver.com/analytics+/quick-charts/marimekko-charts), [product workflow](https://inforiver.com/analytics-plus/marimekko-chart/), [legend documentation](https://docs.inforiver.com/analytics+/working-with-analytics+/3.-charts/3.8.-display-settings-for-charts/charts-legend-settings), [Microsoft column charts](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-column-charts), [Microsoft treemaps](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-treemaps), [Deneb documentation](https://deneb.guide/docs), [Deneb interactivity](https://deneb.guide/docs/interactivity-overview), [Vega-Lite mosaic example](https://github.com/vega/vega-lite/blob/main/examples/specs/rect_mosaic_labelled.vl.json).

An undocumented competitor safeguard is not evidence of its absence. Atlyn's safeguards are reviewable in its own source and tests; no relative correctness or speed superiority is asserted. Marketplace policy [100.1.3](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies) prohibits comparative marketing; do not reuse competitor names or this matrix in the listing.

## Material improvements and remaining limitations

The quality candidate adds shared cumulative boundaries with compensated summation; independent BigInt rational conservation oracles, including maximum grids; bounded 20,000-row input with explicit floating-point precision guidance; responsive plot sizing; readable names/numbers and segment width shares; legend component contribution summaries; native segment/component tooltips; persisted table visibility; lazy/cached formatting; resize model reuse; and unique per-instance high-contrast pattern IDs.

The default remains deliberately conservative: no independent width measure, no automatic ratio inference, no widened minimum bars, no manufactured remainder, no local ranking and no decorative 3D. Native order and identities remain authoritative. Invalid, zero, missing, reduced and unrepresentable inputs have distinct states. A partial displayed denominator is not a market estimate.

Remaining product limitations include palette collisions, English/French-only UI, manual additivity confirmation, bounded mark/table counts, unavoidable missing labels for tiny marks, and an explicit no-chart state at very small sizes. The accessible table supplies retained observations without falsely enlarging them. Supported keyboard/contrast semantics still require native assistive-technology acceptance.

An independent diff review identified compact error diagnostics consuming the Data table's entire height. Browser reproduction then exposed a sticky pager covering the remaining 39-pixel table viewport at 180x160. Open-table error states now cap and scroll diagnostics; compact pagers scroll with the table so they cannot obscure every data row.

## Evidence boundaries

Local unit oracles independently calculate expected ratios. Browser tests extract the final official PBIVIZ and exercise DOM geometry and a mock host API; they do not establish native filter propagation, export, Service, screen-reader integration or certification.

Performance evidence must identify the exact archive hash, hardware/OS/browser/tool versions, 5 warmups, 30 measured samples, typical 12x5 and maximum 200x20/100x40 grids, synchronous update and frame-ready measurements separately, and selection handler/frame timings. Preserve raw samples and p50/p95/max, not just one favorable timing. This shared machine is not an isolated benchmark host; other activity and host-mock overhead limit comparisons. Native timing is a separate coordinator-owned gate.

## Recorded local candidate outcome

Package **1.0.1.0**, **125,085 bytes**, SHA-256 `841f066f1a7696151f5e0803b86eac7abe5f87bc54be6f4701d850ebe0d6b2ae`, recorded **2026-09-09**:

| Local gate | Outcome |
| --- | --- |
| Independent/source/sample unit tests | 159 passed |
| Exact-package functional Chromium cases | 46 passed, 0 skipped/flaky/failed |
| TypeScript, scoped lint and Microsoft-named `eslint` entry point | Passed |
| Full dependency audit and embedded notices | 0 reported vulnerabilities; notices matched |
| SDK certification audit, source scan and actual archive audit | Passed locally; no certification claim |
| Bound PBIP assembly | Exact official payload and package hash; native acceptance pending |
| Visual inspection | Five required viewports and four final sample captures inspected; tiny labels omitted without mark inflation |

Timing observations below are **p50 / p95 / max milliseconds**, nearest-rank across 30 samples after 5 warmups per shape/operation. Environment: Windows 11 Enterprise 10.0.26200 x64, AMD EPYC 7763-reported CPU with 16 logical processors, approximately 64 GiB RAM, Node 24.17.0, Playwright 1.63.0, Chromium 153.0.8010.12. One worker/context; 1280x620, scale factor 1, headless, labels on/table closed; seed 1096043609. Trace/screenshots were off while measuring.

| Segments x components | Sync update | Update to second frame callback | Selection plus Promise microtasks | Selection to second frame callback |
| --- | --- | --- | --- | --- |
| 12x5 (60 cells) | 5.3 / 6.0 / 6.2 | 33.1 / 34.1 / 34.2 | 0.2 / 0.4 / 0.4 | 33.1 / 34.0 / 34.0 |
| 200x20 (4,000 cells) | 67.5 / 77.5 / 78.9 | 95.1 / 110.9 / 112.9 | 6.7 / 7.3 / 8.3 | 33.1 / 35.0 / 44.6 |
| 100x40 (4,000 cells) | 70.0 / 78.8 / 81.5 | 100.0 / 113.5 / 114.8 | 6.9 / 7.7 / 8.2 | 33.0 / 41.5 / 48.8 |

These are warm prepared-DataView observations, not startup, model-query, full-selection-set or native-host latency. Synchronous dispatch-only and forced-layout measurements, raw samples and coarse CPU/RAM counters are retained separately. Two animation-frame callbacks are only a frame-ready proxy, not measured screen presentation. Host identity/Promise overhead, scheduling, natural garbage collection and shared-machine contention are included; there is no timing pass threshold, isolation assertion or comparative speed claim.

The immutable candidate bundle retains final logs/raw evidence, baseline captures and the before-fix failing regression separately. [Submission image provenance](../assets/submission/README.md) distinguishes actual package rendering from native application evidence. Native-host, legal and Marketplace gates remain open in the dossier.
