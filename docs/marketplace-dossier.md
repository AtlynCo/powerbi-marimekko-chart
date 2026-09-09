# Marketplace and certification dossier

**Candidate:** Atlyn Marimekko 1.0.1.0, GUID `AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472`. This is a submission-preparation dossier, not evidence of upload, certification, publication or owner legal approval. The parent coordinator exclusively manages native Power BI and Partner Center.

## Proposed listing copy

**Name:** Atlyn Marimekko

**One-sentence summary:** Compare additive segment size and component mix in one variable-width composition chart.

**Description:**

Atlyn Marimekko displays nonnegative additive values as variable-width, 100% stacked columns. Bind a Segment, Component and Additive value measure, then confirm that the measure can be summed across both dimensions.

Column width shows the segment's share of the supplied total. Component height shows its share within the segment. Rectangle area therefore shows its overall contribution. Model-formatted values and separate segment/overall shares are available in labels, native tooltips and a paginated data table.

Use it for product-region revenue composition and business-unit product mix. The included synthetic offline sample demonstrates both workflows. It is not a source of real market data.

Missing observations are distinguished from measured zeros. Invalid or nonadditive percentage inputs are not silently converted to a valid composition. When Power BI returns incomplete or reduced data, displayed-subset warnings identify the denominator limitation. Authors remain responsible for measure additivity, model filters and the business meaning of the dataset.

Tiny columns are not artificially widened; labels appear only where they fit, and retained observations remain available in the table. The visual supports native selection identities, keyboard controls, high-contrast patterns, English/French UI, RTL layout and a compact presentation.

The visual processes supplied data locally without runtime network requests, telemetry, external assets or a licensing backend. It supports up to 200 segments, 40 components and 4,000 cells simultaneously. Independent width measures, ratios and negative values are outside its mathematical contract.

Native host behavior, supported distribution routes and accessibility must be confirmed for the exact submitted candidate. No Microsoft certification, universal export support or conformance status is claimed here.

**Search keywords:** Marimekko; composition; product mix.

Name/summary/description must remain within 50/100/3,000 characters respectively. No comparative claims, competitor names, fabricated testimonials, pricing promises or certification badges are included.

## Files and reviewer instructions

Use the exact retained PBIVIZ and SHA-256 from the immutable release manifest, not a later rebuild. The manifest also identifies the source commit, toolchain, per-resource hashes, original 20x20/300x300 PNGs, actual final-render screenshots and their provenance, local logs, raw performance samples and bound PBIP package hash.

The PBIP has two actually bound pages with embedded official manifest/payload and synthetic CSV queries. Make an editable copy outside the frozen bundle, set `SampleDataFolder`, refresh both tables, confirm totals of 1,000,000 for each dataset, and compare the native reconciliation tables. On the market page, segment widths are 60/30/10 percent and Atlas/North America has 36 percent overall area. On the product-mix page, inspect the explicit missing observation and measured zeros. Only Desktop can produce the required same-version offline PBIX; this is an unresolved native gate until the parent provides it. Preserve the frozen bundle unchanged and retain the actual PBIX and native acceptance record separately.

Start a fresh visual with unconfirmed additivity, then follow [authoring](authoring.md). Exercise invalid ratios/negative values, all-zero/missing inputs, narrow columns, long labels, sort/filter/highlight/clear/context menus, formatting persistence, keyboard/contrast/RTL, partial loading and native report save/reopen. Use the full [submission checklist](release-checklist.md), not only the sample happy path.

Reviewable source must be frozen on the exact lowercase `certification` branch for this single visual. Coordinate an existing branch before updating it. Private source is allowed, but reviewer access is the owner's responsibility. Do not place validation-account credentials or recovery codes in the repository, PR, manifest or screenshots.

Current detailed listing/publishing pages request 1-5 PNG screenshots at 1366x768, under 1024 KB; the planning page says 1280x720. Both actual-render variants may be retained. The parent must confirm the live upload requirement. Mock-host package captures must not be described as native Desktop/Service screenshots or proof of host acceptance.

## Owner decisions and unresolved release gates

| Gate | Current state / responsible party |
| --- | --- |
| Publisher identity and distribution rights | Owner approval required. |
| Customer EULA or Marketplace standard contract | Not selected/approved. `UNLICENSED` npm metadata is not an EULA. |
| Price/licensing terms | Owner decision outstanding. No runtime license service is implemented; this does not imply free or perpetual rights. |
| Public privacy policy | Owner-authored/approved public URL required; source behavior notes are not legal terms. |
| Support | Approved metadata: Atlyn, `atlyn.help@gmail.com`, `https://www.atlynco.com/docs/faq`; owner must verify public readiness and response ownership. |
| Native Desktop/PBIX/Service/export/accessibility | Parent-controlled acceptance, exact package hash and actual outcomes required. |
| Screenshot upload suitability | Parent verifies dimensions, accurate provenance and intended-host expectations. |
| Source branch and reviewer access | Coordinate/freeze lowercase `certification` after approved baseline. |
| Partner Center configuration/upload/submission | Authorized parent/owner only; no child session upload or account mutation. |
| Microsoft approval/publication | Not granted or asserted. Do not merge/publish automatically. |

## Primary Microsoft requirements

Consulted **2026-09-09**; recheck at submission:

- [Certified custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified): reviewable matching source, lowercase source branch, latest compatible API/tooling, prohibited runtime behavior and certification request.
- [Submission testing](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing): native conversions, invalid fields, modifiers/filters/fit modes, large rows/numbers, profiling and host tests.
- [Publishing guidance](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store), [packaging](https://learn.microsoft.com/en-us/power-bi/developer/visuals/package-visual), [technical configuration](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-technical-configuration): actual package and offline same-version sample.
- [Listing](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-offer-listing), [planning](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-power-bi-visual), [properties](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/power-bi-visual-properties): assets, text limits, legal/support information.
- [Marketplace policies](https://learn.microsoft.com/en-us/legal/marketplace/certification-policies): accurate noncomparative listing and publisher obligations.

Current guidance does not establish a mandatory source-ZIP or GUID-in-email-subject procedure. Follow the live Partner Center certification options and reviewer instructions; `pbicvsupport@microsoft.com` is a support contact, not a substitute for owner-approved submission.
