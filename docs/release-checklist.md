# Release, certification, and submission gates

**Status:** release-quality candidate source and fully authored offline PBIP with the official package embedded. This document is a checklist, not a completed test report. There is no assertion of Microsoft certification, AppSource availability, native Desktop/Service validation, or legal approval.

Record the responsible reviewer, date, tested version/environment, result, and evidence for each applicable gate. A green local audit does not close manual gates. Recheck Microsoft's current requirements when submitting; requirements and host behavior can change.

## 1. Source and package

- [ ] Confirm approved source revision, clean reproducible build inputs, pinned lockfile, Node/npm versions, and generated third-party notices.
- [ ] Before npm/npx commands, set `$env:NPM_CONFIG_CACHE = Join-Path (Get-Location) '.tmp\npm-cache'` in the repository-root PowerShell process. An inherited environment value overrides `.npmrc`; repeat the setup in each new shell.
- [ ] Restore with `npm ci` when dependencies are missing or the lockfile changes. Run `npm run typecheck`, `npm run eslint`, `npm test`, and `npm run test:browser`; retain outputs. Microsoft's expected `eslint` entry point is present.
- [ ] Run `npm run package` through the scoped build wrapper, not a direct `pbiviz` invocation; inspect the actual `.pbiviz` archive, matching hash, manifest, compiled resources, all locales, and icon. `npm run build` is the same wrapper's build-only route.
- [ ] Confirm build-only generated certificate/password/key files were cleaned up and no user certificate store was modified. Do not ship `.tmp` tool-home/cache contents.
- [ ] Verify tracked/generated runtime notices match and the packaged **Open-source notices** button displays the embedded licenses offline.
- [ ] Verify browser tests exercise the actual extracted package with host mocks; do not describe these as native Power BI tests.
- [ ] Run `npm run audit:dependencies` and triage findings according to release policy. It audits the full tree including development/build-tool dependencies, then checks generated/embedded runtime notices. Confirm both stages ran; do not describe “runtime clean” as “all dependencies clean.”
- [ ] Run `npm run audit:certification`; review the script's scope and any warnings. Static scans are necessary engineering checks, not Microsoft's certification process.
- [ ] Run the normal `npm run package` after the SDK audit, then test that exact artifact locally. Preserve package/hash, source commit, tools, screenshots and raw measurement evidence. Do not run GitHub Actions or other hosted CI/CD.
- [ ] Freeze `AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472` for this visual identity. Confirm name `AtlynMarimekko` and candidate package version `1.0.1.0`.
- [ ] Inspect `privileges: []`, no bundled external assets/code loading, no telemetry/network calls, no dynamic evaluation, and no unexpected package contents. Distinguish development server/network behavior from production runtime.

## 2. Native Power BI Desktop

- [ ] Record exact Desktop build, Windows version, locale, tenant policy, and artifact SHA-256.
- [ ] Import the packaged file into a clean report. Verify binding, default unconfirmed state, confirmation persistence, formatting reset, resizing, save/reopen, and replacing/upgrading the visual without changing its GUID.
- [ ] Verify the advertised landing/empty-data, keyboard-focus, highlight, and native multi-visual-selection capabilities in the host rather than relying only on manifest flags.
- [ ] Deserialize the corrected sample with `scripts\validate-sample-tmdl.ps1`, then open `samples\AtlynMarimekko.pbip` in an editable copy with supported PBIP/TMDL/PBIR features. Refresh both inline M tables without a source-path edit and verify totals/order/missing/zero semantics.
- [ ] Verify both already-bound custom visuals and native reconciliation tables load from the embedded official package on the market/product pages. Save and reopen, then create the actual same-version offline PBIX in Desktop. A PBIP, fabricated binary, or schema-only validation does not satisfy the PBIX gate.
- [ ] Check sum measures, genuine zeros, missing combinations, missing measures, blanks in category labels, negative/nonfinite/invalid data, zero-only data, percentage formats, and additivity confirmation.
- [ ] Verify all-blank input reports missing/empty rather than observed all-zero. For invalid/unconfirmed/unsupported percentage input, verify the table preserves available raw values/status while hiding untrusted derived totals/shares.
- [ ] Check native cross-filtering, cross-highlighting with original denominators, multi-selection across visual instances, context menus, tooltips, and clearing selection.
- [ ] Check model **Sort by column**, native host sort, filtering/reordering, and deterministic native series-key colors. Outside high contrast, verify the visual's fixed palette rather than expecting report-theme palette colors.
- [ ] Exercise more than 200 segments, more than 40 components, and more than 4,000 cells. Verify continuation aggregation and bounded attempts in the real host, no duplicate accumulation, and displayed-subset warnings/denominators when fetching/reduction is incomplete.
- [ ] Compare native measures/tables and expected areas for the samples; inspect narrow columns without minimum-width distortion.
- [ ] Convert native stacked column to custom and back, and a gauge with three measures to custom and back. Test removing/replacing fields, invalid/multiple buckets, blank field wells, formatting changes/reset, and returning to valid bindings.
- [ ] Check tooltips/context-menu coordinates at Fit to page, Actual size and Fit to width, after scrolling/resizing, with mouse and touch. Exercise selection modifiers and interaction/filter/slicer scopes.
- [ ] Safely receive 20,000 input rows and 16-digit values: enforce the documented 4,000-cell bound, mark the denominator incomplete, and retain large-number precision warnings. This is not a promise to render 20,000 marks.

## 3. Service, distribution, and export

- [ ] Publish only to an authorized test workspace. Record Service/browser versions and tenant custom-visual settings; confirm allowed deployment route (file import, organizational store, or eventual AppSource).
- [ ] Test viewing/editing, refresh/filter changes, saved report state, bookmarks, selection/highlighting, and actual host data-reduction behavior.
- [ ] Test required browser/device targets; do not infer them from a single Chromium harness.
- [ ] Verify native Chrome, Edge and Firefox routes as applicable, multiple instances and pages, focus mode, dashboard pinning, read/edit modes and saved bookmarks. Record any unsupported surface explicitly.
- [ ] Test PDF/PowerPoint export, printing, subscriptions, and other required host output paths. Uncertified visuals may be omitted or restricted by Power BI. Record each actual outcome; do not claim unsupported export paths work.
- [ ] Confirm the corrected inline M sample has no external file connection or folder parameter in the actual PBIX. Verify Service behavior separately; CSVs are reference artifacts, not refresh sources.
- [ ] Verify rollback/reimport to the previous approved package and document any report compatibility implications.

## 4. Accessibility and localization

- [ ] Screen reader with native Power BI: semantic roles/names, status diagnostics, table headers, missing/zero descriptions, focus entry/exit, and selection announcements.
- [ ] Keyboard only: chart arrow navigation, Home/End, table toggle, 100-row pagination, all selectable controls, Enter/Space, Ctrl/Cmd, Escape, Shift+F10; no keyboard traps.
- [ ] High contrast: patterns and host palette, focus outlines, selected/dimmed states, tooltips, and table readability.
- [ ] Zoom, high DPI, narrow/tall visual sizes, long labels (including the 2,048-character dimensional display limit), 40 components, and zero-width segments without lost access to data. Verify truncated labels retain distinct native identities and unchanged numeric values.
- [ ] English/French host locales, number formats, fallback UI language, and RTL layout with mixed-direction category text. Validate actual translations with a qualified reviewer.
- [ ] Review applicable accessibility obligations. Do not issue a conformance statement from automated tests alone.

## 5. Privacy, legal, and support owner approval

- [ ] Owner approves distribution rights and actual customer license/EULA. `UNLICENSED` is development metadata, not customer-facing terms.
- [ ] Owner approves a public privacy statement consistent with actual runtime behavior and host/model processing. No invented retention, jurisdiction, warranties, SLA, or certification claims.
- [x] Coordinator approved package metadata: author **Atlyn**, `atlyn.help@gmail.com`, support URL `https://www.atlynco.com/docs/faq`, and the private source repository as `gitHubUrl`. Private source hosting is not a support-URL blocker.
- [ ] Verify public contact ownership, URL reachability, mailbox responsiveness, customer-facing support information, and escalation procedure. Approved metadata values alone do not close these publication checks.
- [ ] Review all third-party notices and asset rights, brand/name/trademark usage, accessibility text, and documentation accuracy.
- [ ] Remove confidential sample data and credentials. These CSVs are synthetic; use that labeling in screenshots and listings.
- [ ] Obtain named final approval for the exact package, sample, documentation, intended audience, and deployment channel.

## 6. Microsoft certification / AppSource submission

- [ ] Read the current [certified visuals requirements](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified) and [AppSource publishing guidance](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store).
- [ ] Confirm eligibility, supported APIs, security restrictions, required performance/accessibility behavior, and packaging/source-review requirements.
- [ ] Prepare the actual submission assets requested by Microsoft: package, reviewable source, native-tested sample report, listing text/screenshots/icon, approved legal/privacy/support URLs, and test instructions as applicable.
- [ ] Coordinate the exact lowercase **`certification`** branch with the owner. It must contain the matching source for this one visual, remain frozen during submission, and be accessible to reviewers. Never overwrite an existing submission baseline without approval.
- [ ] Verify 20x20 pane and 300x300 store PNGs, 1-5 accurate final screenshots, and a same-version offline PBIX. Current publishing/listing pages require 1366x768 PNGs under 1024 KB; a planning page instead says 1280x720. The parent must verify live upload validation and use the appropriate actual-render set.
- [ ] Review the [listing dossier](marketplace-dossier.md), all owner-only unresolved decisions, the immutable manifest and native acceptance evidence before any live upload.
- [ ] Complete Partner Center/vendor prerequisites with the authorized organization owner; no credentials belong in this repository.
- [ ] Submit through the authorized process, address reviewer findings, and retain Microsoft's outcome. Only describe the visual as certified or publicly available after that status is actually granted/published.

## Evidence record template

| Gate | Reviewer/date | Environment + package hash | Result | Evidence / issue |
| --- | --- | --- | --- | --- |
| Local checks | Pending | Pending | Not recorded here | Attach actual logs |
| Desktop + PBIP | Pending | Pending | Native validation required | Attach saved native report and steps |
| Service/export | Pending | Pending | Native validation required | Record each output mode separately |
| Accessibility/localization | Pending | Pending | Manual review required | Record assistive technology and locale |
| Legal/privacy/support | Owner pending | Exact release candidate | Approval required | Link approved materials |
| Certification/submission | Not asserted | Exact submitted candidate | Not certified by this checklist | Microsoft outcome, if pursued |
