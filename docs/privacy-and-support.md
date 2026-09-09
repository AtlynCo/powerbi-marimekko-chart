# Runtime privacy facts and support readiness

This is technical release documentation, **not an approved legal privacy notice, EULA, warranty, or support SLA**. Package contact metadata is approved as described below; customer-facing terms and publication readiness still require manual approval.

## Technical data flow

- Power BI supplies the visual with categorical data, numeric values, highlights, formatting, locale, colors, and SDK identities for the fields bound to it.
- The visual computes geometry and renders its SVG, controls, legend, tooltips, and accessible table locally within the Power BI visual environment.
- `capabilities.json` declares an empty `privileges` array. The visual does not request web access, local storage, or file-export privileges. It has no runtime telemetry, network calls, or externally loaded resources.
- Selection, context menus, tooltip services, formatting persistence, and additional-data requests are interactions with the **Power BI host**. They are not promises that Power BI itself is offline or that it never persists/processes report data.
- The provisional corrected sample semantic model uses inline Power Query `#table` literal data, with no external file connection or folder parameter. Bundled CSVs are reference artifacts only. Native M evaluation and report acceptance remain separate checks.
- Source dependency installation, package audits, and browser installation can use network services during development. They are not part of the packaged visual's runtime.
- The **Open-source notices** button reads license text embedded in the package; it does not fetch notices or other external resources.
- Build-only localhost certificates satisfy an SDK packaging check. The wrapper exports generated files only inside the worktree and cleans them up after packaging; it neither installs a certificate nor modifies the user's certificate store. This does not grant runtime privileges.

No claim is made here about Microsoft's retention, tenant residency, consent, or Service processing. Those are governed by the customer's Power BI configuration and applicable Microsoft/organization terms. Review the packaged release for unexpected code/assets as well as the source.

## Approved contact metadata and publication verification

The coordinator has approved the existing `pbiviz.json` contact metadata: author **Atlyn**, email `atlyn.help@gmail.com`, and support URL `https://www.atlynco.com/docs/faq`. The private source repository `https://github.com/AtlynCo/powerbi-marimekko-chart` remains the approved `gitHubUrl`; it is distinct from the public support destination. Private source hosting is **not a support-URL blocker**.

Approval of these metadata values does not establish public contact ownership, reachability, or mailbox responsiveness. Those checks, public support instructions, privacy/EULA links, and escalation responsibilities remain manual publication verification. No response time or service commitment is promised here.

Authorized repository collaborators can also report reproducible engineering issues in the private source repository. External customers are not expected to access that repository for support.

## Useful issue information

- Package version and SHA-256; Desktop or Service/browser build; locale; display scaling.
- The smallest synthetic dataset/model that reproduces the issue, field bindings, additive measure definition/format, and active filters.
- Whether `additiveConfirmed` is enabled and whether completeness/invalid-data warnings appear.
- Exact expected/actual result, reproduction steps, and whether the same bindings reconcile in a native table.
- For accessibility: assistive technology/version, keyboard steps, high-contrast/RTL settings.
- For export: exact host output path and relevant organization restrictions.

Avoid sharing credentials, tokens, customer rows, sensitive screenshots, local cached data, or tenant identifiers without authorization. Use the owner's approved private channel for sensitive reports. Final legal, privacy, support, and distribution approval remains a manual release gate.
