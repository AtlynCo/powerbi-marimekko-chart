# Data and geometry contract

This contract describes v1.0.0.0. It applies to the values supplied to the visual in the current report filter context, not automatically to all rows in the underlying model.

## Field contract

Bind exactly one categorical **Segment**, one categorical **Component**, and one numeric **Additive value** measure. Power BI supplies a categorical data view with segment categories and component dynamic series. Use a measure such as a sum of mutually exclusive revenue amounts or unit counts.

There is no independent width measure. Supplying already-normalized percentages changes the meaning of widths and areas and is unsupported. Ratios, averages, margins, and distinct counts whose members overlap categories are not additive inputs.

**Data contract → Value is additive, not a ratio or distinct count** maps to `dataContract.additiveConfirmed`, default `false`. The author must explicitly confirm before geometry appears. Known percentage-formatted value measures are blocked even if confirmed. A number formatted as an ordinary decimal can still be a ratio: the API cannot reliably inspect arbitrary DAX semantics, so confirmation is not automated inference or a guarantee.

## Mathematics

For a complete, valid displayed grid, let `v[j,i]` be the nonnegative value for segment `j` and component `i`. Missing observations are excluded from sums but are not converted into observed zeros.

```text
segmentTotal[j] = sum of observed v[j,i] over components i
displayedTotal = sum of segmentTotal[j] over segments j
columnWidth[j] = segmentTotal[j] / displayedTotal
cellHeight[j,i] = v[j,i] / segmentTotal[j]
cellArea[j,i] = v[j,i] / displayedTotal
```

Widths, heights, and areas above are fractions of the plot dimensions, not data units. Height applies only to a positive-total segment. There is no division by a zero denominator and no geometry if the displayed total is zero. Each positive-total column stacks to 100%; its area encodes the same additive measure as its width.

**Examples:** in the market-share sample the region totals are 600,000, 300,000, and 100,000. Their widths are 60%, 30%, and 10%. North America's Atlas value is 360,000: 60% of its column and 36% of the whole plot. These are shares of the sample's supplied revenue, not claims about real markets.

### Filtering, highlighting, and rounding

- Report filters can legitimately change the input and its denominator. A full visual result means complete **for the current filter context**, not for the business universe.
- Cross-highlighting is an overlay relative to the original base segment totals. It does not renormalize highlighted values into a new 100% composition or resize base columns. Invalid highlights disable the overlay rather than altering valid base values.
- Raw values use model formatting. Within-segment and overall/displayed-subset shares are derived by the visual. Rounded text may not add to exactly 100%; geometry is not calculated from rounded labels.
- Extreme numeric ranges that cannot produce reliable geometry are diagnosed rather than silently coerced. Rescale the additive measure in the semantic model if needed.

## Missing, zero, and invalid are different states

| Input/state | Meaning and behavior |
| --- | --- |
| Blank/null/absent value | Missing observation; displayed as missing in the table, not a measured zero. It contributes no amount to totals. |
| Observed numeric zero | Valid measured zero; retained as zero in the table. It has no rectangle area. |
| Segment with zero total | Retained in the table with zero mathematical width; no minimum-width inflation. Within-segment share is unavailable. |
| All observations missing | Missing (`blank`) and empty (`empty`) diagnostics, not an observed all-zero (`zero`) diagnostic. No meaningful composition or geometry; inspect missing values in the table. |
| All observed values zero | No geometry; table remains the way to inspect those observations. |
| Negative, nonfinite, or nonnumeric supplied value | Blocks geometry with a diagnostic. Do not silently discard it or substitute zero. Correct the measure/data. |
| Unsupported percentage format or missing additivity confirmation | Blocks geometry; correct binding/semantics or explicitly confirm a genuinely additive measure. |
| Missing valid host identities | Host selection cannot safely be fabricated from text labels; inspect the diagnostic and fix/rebind fields. |

Blank category labels and blank numeric values are different concepts. A host-supplied blank category can still have a valid identity; a missing numeric observation is still missing.

When input is invalid, additivity is unconfirmed, or a percentage-formatted measure is unsupported, the table retains available raw values and cell status but marks derived totals/shares unavailable. Identity and numeric-range failures likewise prevent untrusted totals from being presented. Invalid cells are identified as invalid, not converted into apparent zero observations. The table's continued availability is for diagnosis; it is not approval to interpret rejected data as a valid composition.

## Completeness and bounded results

The render budget is **200 segments**, **40 components**, and **4,000 segment/component cells**, including missing/zero positions in the displayed grid. These are simultaneous bounds: a 200-by-40 grid exceeds the cell budget. A prefix can therefore contain fewer segments than the segment maximum.

The categorical mapping requests segment windows and an extra component reduction sentinel beyond the renderable component maximum. When Power BI supplies `metadata.segment`, the visual attempts additional data with **`fetchMoreData(true)`**. This requests cumulative host aggregation. A subsequent data view is treated as the cumulative result; it must not be appended again locally. Attempts are bounded; refusal, retained continuation metadata, or a bound prevents endless fetching.

**Any continuation marker, detected limit, or reduction sentinel means the result is not asserted complete.** If bounded geometry is drawn, the visible warning, table/share headings, and total distinguish a **displayed subset**. The denominator is only the sum of retained, displayed cells. With component reduction, even a displayed segment's total can be incomplete: neither width nor within-segment mix can be interpreted as the unreduced population.

The prefix preserves received host order; it is not a statistical sample, top-N ranking, inferred remainder, or synthetic “Other” category. Never extrapolate its shares. Filter to a smaller scope or aggregate categories in the model to obtain complete, decision-appropriate results. Compare a native table/measure with the visual before using shares in a decision.

The visual can only diagnose signals made available by the host. Absence of a continuation marker cannot prove that an upstream model, query, filter, or connector represents a complete real-world population. Authors own that definition.

## Ordering, color, and narrow columns

The visual preserves category and component order received from Power BI, including host **Sort by column** behavior. Set ordering in the model/host; there is no local “helpful” alphabetical or value sort. RTL changes layout direction, not the category/value associations.

Component colors use a deterministic hash of each native host series key into the visual's fixed palette, so filtering/reordering does not deliberately reassign colors by visible index. Outside high contrast, colors do **not** come from the report theme palette. High contrast uses host colors with patterns, and labels/table text provide non-color identification. Hash collisions and palette/pattern reuse are possible; do not use color alone to identify a component.

Segment and component display labels are capped at **2,048 characters** (JavaScript UTF-16 string units). This is a display-string limit, not a truncation of host identities or numeric values: long labels do not cause categories to be merged. Use shorter dimensional labels in the model for readable legends, tables, and tooltips.

Column widths remain mathematically exact. `appearance.minLabelWidth` controls whether a label is eligible, **not** a minimum column width. Labels that cannot fit are omitted. The legend and paginated table keep tiny, zero, and missing observations discoverable.
