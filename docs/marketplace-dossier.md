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

Acquire through existing Atlyn storefront subscriptions. The visual is ungated, with no licence-key checks or paid-author feature enforcement; report viewing is free. Normal Power BI platform and sharing requirements still apply.

Native host behavior, supported distribution routes and accessibility must be confirmed for the exact submitted candidate. No Microsoft certification, universal export support or conformance status is claimed here.

**Search keywords:** Marimekko; composition; product mix.

Name/summary/description must remain within 50/100/3,000 characters respectively. No comparative claims, competitor names, fabricated testimonials, unapproved price guarantees or certification badges are included.

## Approved commercial model and current evidence

On **2026-09-10**, the owner approved the reference pattern: **storefront subscriptions, ungated visuals**. Existing Atlyn subscriptions govern external acquisition. The renderer does not enforce author entitlements, and report viewing is free. There is no pending runtime licensing integration: do not add licence keys, a signer, AAD/API integrations, feature gates, runtime checks, WebAccess or external licence calls. No package/version change is needed for this decision.

The owner explicitly selected Microsoft's official **Power BI certified** badge, requested through the Partner Center checkbox **Request Power BI certification**. **REQUEST/REVIEW PENDING:** the parent will select that option only after the final gate; Microsoft alone awards/displays the badge after additional review. This is not the "Additional purchase may be required" IAP disclosure, an in-visual badge or marketing artwork. No badge graphic is required from the parent, and no badge/certification status is granted or claimed.

Source licensing and customer/storefront terms remain distinct: this repository has **no tracked first-party LICENSE/LICENCE file**, and npm metadata is **UNLICENSED**, unchanged. Do not relicense the source or substitute third-party notices for first-party terms.

**Coordinator-reported native progress, received 2026-09-10:** the corrected PBIP opened and evaluated real M in Desktop; all nine market revenue rows reconciled to $1,000,000; SVG widths of 60/30/10 percent and Atlas heights of 60/40/20 percent were visually confirmed. A genuine **158,299-byte PBIX** was saved with the owner-approved **Public sensitivity label**, and a PrintWindow native screenshot was obtained. That label is not public publication or permission to expose the repository. The coordinator retains these native files; their final paths/hashes, reopen and remaining scenarios are pending. This report is not a substitute for the final native evidence handoff or complete acceptance.

**Native package comparison, reported by the coordinator:** the SDK manifest is 781 bytes with LF line endings; the earlier sample handoff and saved PBIX contain 797 bytes with CRLF line endings. Text is identical after normalization, and the 719,455-byte runtime payload is byte-identical (SHA-256 `d332fdd436e19d9d537c41b9bcf45e2110fa888499620593278e6b10a0b420ac`). This identifies a pre-Desktop handoff conversion, not Desktop corruption. Normalized equality does not satisfy the all-entry byte-fidelity requirement. The corrected source protects embedded SDK entries from Git text conversion and supplies a binary-safe handoff; the parent must retry that sample before final acceptance.

## Files and reviewer instructions

Use the exact retained PBIVIZ and SHA-256 from the immutable release manifest, not a later rebuild. The manifest also identifies the source commit, toolchain, per-resource hashes, original 20x20/300x300 PNGs, actual final-render screenshots and their provenance, local logs, raw performance samples and bound PBIP package hash.

The corrected PBIP has two actually bound pages with embedded official manifest/payload and self-contained inline M literal tables. Use the distinct corrected sample, not the original sealed sample with invalid TMDL references. Keep an editable copy and reconcile both datasets against their native tables. On the market page, widths are 60/30/10 percent and Atlas/North America has 36 percent overall area. On the product-mix page, inspect the explicit missing observation and measured zeros. The coordinator has reported saving the actual offline PBIX; final file/hash delivery and remaining native acceptance are still required. Preserve all frozen folders unchanged and retain the native evidence separately. The existing ungated renderer is intended for the approved acquisition model; it is not waiting for paid entitlement code.

Start a fresh visual with unconfirmed additivity, then follow [authoring](authoring.md). Exercise invalid ratios/negative values, all-zero/missing inputs, narrow columns, long labels, sort/filter/highlight/clear/context menus, formatting persistence, keyboard/contrast/RTL, partial loading and native report save/reopen. Use the full [submission checklist](release-checklist.md), not only the sample happy path.

Reviewable source must be frozen on the exact lowercase `certification` branch for this single visual. Coordinate an existing branch before updating it. Private source is allowed, but reviewer access is the owner's responsibility. Do not place validation-account credentials or recovery codes in the repository, PR, manifest or screenshots.

Current detailed listing/publishing pages request 1-5 PNG screenshots at 1366x768, under 1024 KB; the planning page says 1280x720. Both actual-render variants may be retained. The parent must confirm the live upload requirement. Mock-host package captures must not be described as native Desktop/Service screenshots or proof of host acceptance.

## Owner decisions and unresolved release gates

| Gate | Current state / responsible party |
| --- | --- |
| Publisher identity and distribution rights | Owner approval required. |
| First-party source license | No tracked LICENSE/LICENCE file; npm `UNLICENSED` unchanged. No relicensing authorized. |
| Customer EULA or Marketplace standard contract | Separate owner publication requirement; do not infer terms from npm metadata or the ungated renderer. |
| Acquisition/runtime model | Approved: existing Atlyn storefront subscriptions, ungated authoring/runtime and free viewing. No runtime licensing implementation blocker. |
| Official Power BI certified badge | Owner approved **Request Power BI certification** in Partner Center. **REQUEST/REVIEW PENDING**, parent-owned after the final gate; only Microsoft awards/displays it. No IAP-disclosure substitution or artwork task. |
| Public privacy policy | Owner-authored/approved public URL required; source behavior notes are not legal terms. |
| Support | Approved metadata: Atlyn, `atlyn.help@gmail.com`, `https://www.atlynco.com/docs/faq`; owner must verify public readiness and response ownership. |
| Native Desktop/PBIX/Service/export/accessibility | Partial Desktop/M/market geometry and saved PBIX reported. Runtime payload exact; earlier manifest differs only by CRLF. Corrected byte-faithful sample retry, final files/hashes, reopen and remaining scenarios pending with parent. |
| Screenshot upload suitability | Parent verifies dimensions, accurate provenance and intended-host expectations. |
| Source branch and reviewer access | Hold `certification` and `main` movement, merge and submission until the coordinator's final gate; then arrange matching source/reviewer access. |
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
