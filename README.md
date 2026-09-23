# Atlyn Marimekko

An offline Power BI custom visual for comparing **segment size and component mix at the same time**. Segment totals determine column widths; each column is stacked to 100%; each rectangle's area represents its contribution to the displayed total.

**Release candidate:** `1.0.1.0` · **Visual name:** `AtlynMarimekko`

**Frozen visual GUID:** `AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472`

This is a private-repository first-release implementation, **not a claim of Microsoft certification, AppSource publication, or completed native-host validation**. See the [release gates](docs/release-checklist.md) before distributing it.

## Install and try it

1. Obtain the approved `.pbiviz` from your release owner, or [build it](#development).
2. In Power BI Desktop, use the Visualizations pane's **… → Import a visual from a file** and select `dist\AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472.1.0.1.0.pbiviz`. Tenant policy may restrict custom or uncertified visuals; do not bypass it.
3. Add Atlyn Marimekko to the canvas and bind exactly these three fields:

   | Field well | What to bind | Market-share sample |
   | --- | --- | --- |
   | **Segment** (`segment`) | One categorical column | `ProductRegion[Region]` |
   | **Component** (`component`) | One categorical column, used as dynamic series | `ProductRegion[Product]` |
   | **Additive value** (`value`) | One nonnegative additive measure | `ProductRegion[Market Revenue]` |

4. Review the measure's meaning. Enable **Format → Data contract → Value is additive, not a ratio or distinct count** only if it can safely be summed across both dimensions. The setting is off by default; no geometry is drawn before confirmation.
5. Use the included [self-contained PBIP and offline reference CSVs](samples/README.md). Both market-share and product-mix pages include a bound custom visual, the exact embedded package, inline M literal data and native reconciliation tables. The corrected sample needs no file-path parameter. The coordinator reports successful Desktop open/M refresh, market-row reconciliation, expected SVG geometry and a genuine saved PBIX; reopen and the remaining native scenarios are still pending.

There is **no width-measure role in v1**. Do not bind precomputed market-share percentages, averages, ratios, or overlapping distinct counts. Known percentage-formatted measures are blocked even after confirmation. Power BI's visual API cannot reliably identify every nonadditive DAX expression; the author must verify semantics.

## Behavior at a glance

- Missing values remain missing, not observed zeros. All-blank input reports missing/empty data, not observed all-zero data. Invalid, nonfinite, or negative values block geometry; all-zero data has no geometry. Zero-total segments remain discoverable in the data table.
- For invalid, unconfirmed, or unsupported percentage-measure input, the table preserves available raw values/status while withholding untrusted derived totals and shares.
- Host category and component order is preserved, including the received **Sort by column** order. No local value/alphabetical sort changes the story.
- Component colors use a deterministic host series-key hash into the visual's fixed palette, not the visible position or report theme palette. High contrast uses host colors and patterns.
- Quantitative widths are retained, including very narrow columns, subject to floating-point precision. Labels hide when they do not fit; widths never expand to make labels fit. Shared cumulative boundaries close the extent without independently accumulated gaps.
- Native SDK selection identities support cell, segment, and component selection, Ctrl/Cmd multiselect, host context menus, and tooltips. Highlights retain the original base-value denominators.
- The accessible table is always available through its toggle and is paginated at 100 rows. Keyboard navigation, English/French UI strings, RTL layout, and no animation are part of v1.
- The capability manifest enables landing/empty-data views, keyboard focus, highlights, and native multi-visual selection. Actual host behavior remains a native acceptance gate.
- Rendering is bounded to **200 segments, 40 components, and 4,000 cells**. Partial/reduced results are explicitly labeled with a **displayed-subset denominator**; they must not be presented as complete-population shares.
- Dimensional display labels are capped at **2,048 characters** (JavaScript string units); host identities and numeric values are not truncated.
- Runtime declares `privileges: []`: no visual-owned network, external service, local-storage, or file-export privilege. Host-driven report operations and model refresh have their own behavior.

Read the [data contract](docs/data-contract.md) and [authoring/accessibility guide](docs/authoring.md) for details and limitations.

## Development

Use Node.js **22.12 or newer** and npm. The package targets visual API **5.11.0** (the contract exported by the current **5.11.1** API declarations) and uses **powerbi-visuals-tools 7.2.1**. Packaging on Windows requires Windows PowerShell/.NET with `CertificateRequest`; other operating systems require `openssl`. From the repository root:

```powershell
$env:NPM_CONFIG_CACHE = Join-Path (Get-Location) '.tmp\npm-cache'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.tmp\browsers'
npm ci
npm run typecheck
npm run lint
npm run eslint
npm test
npm run audit:dependencies
npm run audit:certification
npm run package
npm run sample:assemble
npm run test:browser
```

`npm run audit:dependencies` audits the **full dependency tree, including development dependencies**, then verifies the generated/embedded runtime notices. The current coordinator-reported audit baseline is zero findings; rerun it for each candidate. The checked-in `.npmrc` supplies a worktree-local cache **default**, but an inherited environment setting takes precedence. Set `NPM_CONFIG_CACHE` as shown **before installation or other npm/npx commands**, in the same PowerShell process; repeat it in each new shell.

The Playwright browser suite executes the **actual extracted packaged visual code**, with mocked Power BI host services. This checks the shipped implementation, but not native Power BI integration. If its first run reports a missing browser, install the matching browser with `npx playwright install chromium` in the same shell with the worktree-local `PLAYWRIGHT_BROWSERS_PATH` shown above, then rerun the suite. Build tooling and dependency/browser installation can require internet access; this is distinct from the visual's offline runtime.

`npm run package` builds and verifies the `.pbiviz`; its companion SHA-256 file is written in `dist`. `npm run build` is the wrapper's build-only route. Run the normal package command after the SDK certification audit so the final candidate is a normal distributable package. PowerShell can independently inspect the package hash:

```powershell
Get-FileHash .\dist\AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472.1.0.1.0.pbiviz -Algorithm SHA256
```

**Use `npm run package`, not a direct `pbiviz` invocation.** The `scripts\build.mjs` wrapper runs the standard SDK package command with `--all-locales --no-stats`, scopes the SDK home/cache under the worktree's `.tmp` directory, and keeps normal package output in `dist`.

Before launching SDK subprocesses, the wrapper removes inherited `HOME`, `USERPROFILE`, and `NPM_CONFIG_CACHE` keys case-insensitively, then sets its own worktree-local values. This avoids duplicate environment-key casing collisions on Windows. It does not replace the explicit cache setup needed before `npm ci`.

The SDK checks for a development certificate even during offline packaging. On Windows, the wrapper creates a localhost certificate in memory with PowerShell/.NET `CertificateRequest`, exports it only under `.tmp\tool-home`, and removes the generated PFX/password in the packaging `finally` cleanup. It does **not** install a certificate or touch the user's certificate store. The non-Windows route uses `openssl` and cleans up its generated key/certificate files. This is build-only SDK setup, not a runtime network feature.

Unit tests, browser-host mocks, static audits, and package inspection provide engineering evidence, **not proof of Power BI Desktop/Service/export compatibility or certification**.

Validation and packaging run **locally only**. This repository has no hosted-CI workflow; do not run GitHub Actions, cloud coding, Codespaces, or another hosted build service. Git push and pull-request review are delivery steps, not permission to run remote validation. Preserve the exact candidate package and local evidence through the owner's release process.

## Open-source notices

Under **Info**, the visual's **Open-source notices** button displays bundled runtime dependency license texts offline. These are embedded through generated `src\notices.ts` and also recorded in the tracked [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt). When dependencies change, run `npm run notices` and review both generated files; `npm run audit:dependencies` checks that they match the installed locked dependency tree. These notices license the identified third-party code, not the Atlyn product.

## Documentation

- [Data, mathematics, completeness, and bounds](docs/data-contract.md)
- [Field binding, formatting, selection, accessibility, troubleshooting](docs/authoring.md)
- [Offline datasets and bound PBIP source](samples/README.md)
- [Release, certification, and submission checklist](docs/release-checklist.md)
- [Release-quality review and primary-source comparison](docs/quality-review.md)
- [Marketplace listing and certification dossier](docs/marketplace-dossier.md)
- [Maintenance and compatibility policy](docs/maintenance.md)
- [Runtime privacy facts and support readiness](docs/privacy-and-support.md)

## Acquisition and licensing status

The owner approved **existing Atlyn storefront subscriptions with ungated visuals** on 2026-09-10. Acquisition is external to the visual; authoring is not subject to paid-author runtime enforcement, and report viewing is free. Normal Power BI platform and sharing requirements still apply. The current renderer is the intended implementation: no licence keys, signers, AAD/API integrations, feature gates, runtime licence checks or external licensing calls are required.

The owner approved requesting Microsoft's official **Power BI certified** badge through the Partner Center checkbox **Request Power BI certification**. **Request/review pending:** only Microsoft awards and displays the badge after its additional review. This is not the "Additional purchase may be required" disclosure or an in-visual/marketing graphic; do not add badge artwork or claim certification. Final native assets, saved-PBIX package equivalence and the remaining publication gates are still pending; do not move `certification`, update `main`, merge or submit before the coordinator's final gate.

**First-party source terms:** no tracked first-party `LICENSE`/`LICENCE` file is present, and `package.json` remains `UNLICENSED`. No license terms are added, changed or inferred here. This metadata is not a customer EULA; source licensing, storefront terms, public privacy/support information and distribution approval are separate matters. Third-party notices apply only to their identified dependencies.

Approved package contact: **Atlyn** · `atlyn.help@gmail.com` · [Support FAQ](https://atlynco.github.io/atlyn-powerbi-support/docs/faq/) · [Terms of Service](https://atlynco.github.io/atlyn-powerbi-support/legal/terms/) · [Privacy Policy](https://atlynco.github.io/atlyn-powerbi-support/legal/privacy/). Public contact ownership, reachability, and mailbox responsiveness still require publication verification. The private source repository remains the package's `gitHubUrl`; it is not the public support URL.
