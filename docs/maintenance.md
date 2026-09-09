# Maintenance and compatibility

## Identity and versioning

Keep the visual GUID **`AtlynMarimekkoC9A58644D8B64B04A31C6770C8EA9472`** stable for every compatible update to this visual. It is the persistent host identity, not a build identifier. Do not regenerate it when packaging or “fix” an existing report by shipping a different GUID.

The visual name is `AtlynMarimekko`; the current quality candidate is `1.0.1.0` (npm `1.0.1`), following the original `1.0.0.0` implementation. Increment the package version for an approved update; verify the generated manifest and file name agree. Version changes alone do not establish backward compatibility.

Roles `segment`, `component`, and `value`, formatting objects/properties, and serialized enum values are report-facing contracts. Preserve existing descriptors unless a deliberately reviewed migration is necessary. In particular, preserve the opt-in `dataContract.additiveConfirmed` behavior and do not silently turn it on for existing reports.

## Safe change workflow

1. Make a focused change with regression coverage. Keep model/data conversion separate from rendering and host interactivity where possible.
2. Run the smallest relevant existing tests first, then the release commands listed in the README for the final candidate.
3. When dependencies change, update the lockfile with npm, regenerate notices with `npm run notices`, and review both tracked `THIRD-PARTY-NOTICES.txt` and generated `src\notices.ts`. Runtime license texts are embedded and exposed by the visual's **Open-source notices** button. Rerun dependency/package audits. Do not add runtime packages without considering offline behavior, notices, security, and payload cost.
4. Check the packaged archive, not only source. Hash the final artifact and retain reproducible release evidence outside local build caches.
5. Re-run affected native Desktop/Service/export/accessibility gates. A host API, formatting utility, or packaging-tool upgrade requires host regression tests even when unit tests pass.
6. Obtain release owner approval. Replace/update the visual through the supported host route and verify saved reports still bind, retain settings/order/colors, and select correctly.

Keep the package API version and SDK development version intentionally compatible; they are not expected to be textually identical. Consult Microsoft API compatibility documentation before upgrades.

### Scoped SDK packaging

Use `npm run package` for the release artifact rather than running `pbiviz` directly. The build wrapper invokes the standard **powerbi-visuals-tools 7.2.1** CLI package operation with `--all-locales --no-stats` and isolates its tool home/npm cache under the worktree. The package API is **5.11.0**, as exported by API declarations package **5.11.1**.

The checked-in `.npmrc` sets a worktree-local cache default, but environment variables override it. From the repository root, explicitly scope the cache **before `npm ci` or other npm/npx commands**, in the same PowerShell process:

```powershell
$env:NPM_CONFIG_CACHE = Join-Path (Get-Location) '.tmp\npm-cache'
```

Repeat this setup in each new shell. The build wrapper separately removes inherited `HOME`, `USERPROFILE`, and `NPM_CONFIG_CACHE` environment keys **case-insensitively**, then supplies its own worktree-local values to subprocesses. Preserve this normalization when maintaining the wrapper: differently cased duplicate environment keys can collide on Windows. Build-time isolation does not retroactively scope an earlier dependency installation.

Even offline packaging triggers the SDK's development-certificate check. On Windows, PowerShell/.NET `CertificateRequest` creates a localhost certificate in memory and exports the PFX/password only under `.tmp\tool-home`; packaging cleanup removes them in `finally`. No certificate installation or user certificate-store modification occurs. Other systems require `openssl` for worktree-local certificate/key generation and cleanup. Review cleanup and path isolation when changing the wrapper; do not replace it with certificate-install commands or global SDK configuration.

Browser tests exercise code extracted from the packaged artifact, with host mocks supplying the Power BI API surface. Retain this package-level coverage while keeping native host acceptance separate.

The SDK uses JSZip's current-date defaults for archive entries. `scripts\zip-defaults.mjs` configures its exported `defaults.date` to the canonical ZIP epoch (1980-01-01 UTC) before the unchanged SDK CLI runs. It asserts the SDK and this project resolve the same pinned JSZip module. This is build-only configuration: no dependency files, emitted JavaScript, or completed archive are patched, and global `Date` is not replaced. ZIP entry timestamps are deliberately not build dates. Record actual execution times in release evidence. The package verifier checks canonical dates and separate manifest/payload/JavaScript/CSS/icon hashes. Repeated same-toolchain builds must be compared before claiming byte reproducibility; no cross-platform/toolchain guarantee follows from one local result.

### Dependency audit baseline

On **2026-09-09**, the coordinator reported **0 vulnerabilities from the full npm audit**, including development dependencies, after updating `tsx` to `4.23.13` and applying explicit `qs: ^6.16.0` and `sockjs → uuid: 11.1.1` overrides. These versions/overrides are recorded in `package.json` and the lockfile. This is a point-in-time audit result, not a lasting absence-of-vulnerabilities guarantee; rerun `npm run audit:dependencies` for each release candidate and retain the actual output. Do not remove the overrides without checking their original purpose, compatibility, and the resulting audit.

The dependency-audit script runs the full-tree npm audit first, then verifies both generated runtime-notice outputs. A failed audit stops the chained notice check; resolve the audit and rerun rather than assuming both stages completed.

### Local validation and artifact retention

Run the commands in the README locally. GitHub Actions and other hosted CI/CD are prohibited for this project; workflow configuration has been removed. Do not use a cloud coding environment, Codespaces, or a hosted build service. A Git push or PR is not authorization to run remote validation. Keep npm, SDK and browser caches within the worktree.

Preserve the final package, its hash, local test and measurement evidence, source-commit identity, tools inventory and submission assets in the immutable candidate manifest. Temporary caches are not release evidence. Native acceptance and live Marketplace submission are controlled by the release coordinator; a child implementation session must not manipulate shared Desktop, Service or Partner Center UI.

After the final source, sample and submission images are committed and local evidence is under `.tmp\quality-evidence\final`, run `npm run release:freeze`. It refuses a dirty source tree, blocked/stale browser results or an existing output, checks package/sample/image identity, and writes a commit-and-hash-addressed `dist\release-...` directory with the source ZIP, runnable offline sample, package, images, logs, raw measurements, inventory and manifest hash. The source ZIP is a convenience snapshot, not an asserted Microsoft upload requirement. Copy the complete immutable directory to durable session/owner storage before removing this worktree; do not ship caches, certificates or credentials.

## Changes that require special review

- Denominator, missing/zero handling, invalid-value checks, percent-format detection, or additivity confirmation.
- Fetch continuation semantics, reduction sentinels, safety limits, or any “Other” aggregation. Never append cumulative `fetchMoreData(true)` results twice.
- Host selection identities, sort behavior, or persistent series-color keys.
- Width/layout changes: minimum pixel widths would break the mathematical area contract.
- Stored formatting descriptor renames, role changes, API/SDK updates, localization, and focus order.
- New privileges, network endpoints, storage, export, telemetry, assets, or third-party packages. Update privacy/security documentation and obtain owner approval before release.

## Sample and report source hygiene

The PBIP is text source with local import queries, not a native-validated binary report. Native users should save their customized copy outside the tracked starter or review Desktop-generated diffs carefully. Do not commit `.pbi` local settings, data caches, credentials, local absolute paths, or unpublished customer data. Close Desktop before external PBIP/TMDL edits; reopen to reload them.

The official embedded-resource path repeats the frozen GUID and can exceed legacy Windows path limits in a deep worktree. Use a short local checkout/editable sample path for Desktop. For Git operations in an existing deep checkout, use command-scoped `git -c core.longpaths=true ...`; the freeze script does this without modifying shared/global Git configuration.

Keep sample CSV order keys one-to-one with labels, measures additive, and expected totals in `samples\README.md` in sync. Preserve the distinction between the deliberately missing value and observed zeros. Validate referenced entities/properties whenever table or column names change.

## Support and incident triage

Reproduce against the exact package hash and host build. Start with a synthetic minimal model and record active filters, field bindings, additivity setting, completeness warning, and model measure/format. Separate visual bugs from model semantics, tenant restrictions, and unsupported host export modes.

Security/privacy incidents should follow the owner's approved private process; do not put secrets or customer data in public issues. Before shipping a fix, consider rollback to the prior approved package with the same GUID, then test saved-report compatibility. There is no promised SLA or automatic-update channel in this repository.
