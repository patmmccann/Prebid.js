# Security Policy

## System and Scope

Prebid.js is a browser library that runs header bidding on publisher pages. Publishers
choose the modules, configure auctions and privacy controls, and integrate with ad
servers, consent management platforms (CMPs), and third-party services.

This policy covers the code and delivery paths in this repository:

- `src/`: public APIs, auction orchestration, bidder interfaces, network helpers,
  creative messaging, rendering, storage, and activity controls.
- `modules/` and `libraries/`: bidder, analytics, user ID, real-time data, consent,
  server-side bidding integrations, and their shared helpers.
- `creative/`: code compiled for execution inside creative frames.
- Build tooling, `plugins/`, `customize/`, `web-bundler/`, dependencies, and
  `.github/`: production bundle integrity and contributor, CI, and release security.
- Tests and `integrationExamples/` as evidence of intended behavior and integration
  assumptions; examples do not establish production security guarantees.

Separate services and projects, including Prebid Server, ad servers, CMPs, and bidder
backends, have their own security boundaries. Defects in this repository's handling
of their responses or integration with them remain within scope.

## Threat Model and Trust Boundaries

Important assets include publisher-page execution and DOM integrity, auction and
targeting integrity, user identifiers, consent signals, first-party data, browser
storage, and credentials or artifacts used to build and publish releases.

Publishers control their configuration and the scripts and modules they load.
Loaded modules execute with the privileges of their JavaScript context; core APIs
are not a sandbox for arbitrary publisher-authorized JavaScript. Selecting a module
or endpoint does not make data returned by that endpoint trustworthy.

Potentially hostile inputs include bidder and Prebid Server responses, nested
creative and native-ad data, remote configuration, URLs, and messages from other
windows or frames. Identify which actor can actually control each input. A message
type or an ad identifier alone does not demonstrate that its sender is authorized.

Distinguish the publisher page from cross-origin creative frames, the browser from
remote services, and untrusted contribution content from privileged CI and release
execution. Browser-origin protections and integration-specific frame settings are
relevant controls, but their presence and effectiveness must be established for the
affected path.

## Security Invariants

These are intended properties to assess, rather than a claim that every path
already enforces them:

- External data must not modify shared JavaScript prototypes or become executable
  code in a more privileged context through parsing, merging, or interpolation.
  Review both shared helpers and adapter-specific parsing and data handling.
- Creative messaging and rendering must preserve the intended frame boundary.
  Requests, replies, native actions, and render events must be associated with the
  appropriate bid and permitted action, without exposing unrelated sensitive data
  or enabling unintended publisher-page operations.
- Effective consent, activity, storage, and user-sync restrictions must apply to
  the operations and data they govern, including aliases and server-side paths.
  Denied activities must not proceed through an alternate helper or callback.
- Bid requests, analytics, synchronization, and other outbound data flows must
  respect applicable configured restrictions and redaction. A data item available
  to one component must not thereby become available to every recipient.
- Malformed or adversarial input must not cause an unintended permission grant,
  corrupt unrelated auctions, or cause disproportionate browser resource use.
- Untrusted pull-request content and build inputs must not obtain release secrets,
  privileged workflow execution, or the ability to alter published artifacts
  outside the intended review and release process.

## Reportable Findings and Severity Context

Report a concrete violation of a security boundary or intended control. Describe
the affected version or commit, module selection and configuration, attacker
capability, input entry point, reachable code path, and resulting impact. A minimal
reproduction or a clear source-to-impact explanation helps establish reachability.

Examples include unintended publisher-origin script execution, cross-frame data
disclosure or unauthorized actions, prototype pollution with meaningful impact,
bypasses of effective privacy controls, and compromise of build or release integrity.
Assess availability issues by their effect on the page or other auctions, attacker
effort, and repeatability, rather than treating every rejected bid as a security bug.

Severity depends on required privileges and interaction, deployment exposure,
affected users, data sensitivity, and the scope of integrity or availability loss.
State when an issue requires an optional module or a particular configuration;
neither condition alone makes it unreportable. For dependency advisories, explain
whether the vulnerable behavior is reachable in a shipped bundle or a build/CI path.

## Scope Limits and Known Limitations

This policy establishes no blanket finding-class exclusions or accepted risks.
Any proposed exception needs an explicit maintainer decision with its scope and
rationale. Missing evidence about an integration or control is an uncertainty to
record, rather than proof that a finding is safe.

Creative HTML, scripts, and external renderers are intentionally executed in their
intended rendering context. Assess whether attacker-controlled data gains an
unintended capability or crosses a boundary; the presence of an execution sink
alone does not establish that impact.

Privacy behavior depends on the selected modules, CMP integration, publisher
configuration, rule priorities, and timing. Activity checks allow an operation when
no applicable rule decides otherwise; do not assume a universal default-deny
policy. Storage and activity helpers are controls for cooperating code, not browser
isolation against scripts already executing with publisher-page privileges.

The shared untrusted-JSON parser covers specific response paths. Adapter-specific
parsers and downstream merges require their own assessment. Tests document intended
behavior, but neither tests nor helper names prove that every caller is protected.

## Reporting a Vulnerability

Keep suspected vulnerabilities, exploit details, credentials, and user data out of
public issues and pull requests. Use **Report a vulnerability** in the affected
repository's Security tab when private reporting is available. Otherwise, ask a
repository maintainer for a private reporting channel without publishing sensitive
details. Include the affected version, required configuration, reproduction steps,
and expected security impact, using synthetic or redacted data.
