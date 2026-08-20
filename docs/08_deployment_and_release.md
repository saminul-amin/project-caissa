# Caissa — Deployment and Release Specification

**Document ID:** CAISSA-REL-001  
**Document Type:** Deployment, Delivery, Operations, and Release Management Specification  
**Version:** 1.0  
**Status:** Approved for CI/CD and Release Implementation  
**Product:** Caissa  
**Product Slogan:** Beyond the Best Move  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Frontend Engineering, Backend Engineering, AI Engineering, QA, DevOps, Product, Security Reviewers, Release Managers, and Codex-assisted development

---

## 1. Purpose

This document defines how Caissa is built, validated, packaged, deployed, released, monitored, rolled back, and supported.

It converts the approved technical architecture and testing requirements into an operational system covering:

- Deployment environments
- Continuous integration
- Continuous delivery
- Static web deployment
- itch.io HTML5 distribution
- Maia service container deployment
- Configuration and secrets
- Artifact versioning
- Database and model compatibility
- Release channels
- Approval gates
- Rollback and recovery
- Observability
- Incident handling
- Release documentation
- License and provenance packaging
- Post-release verification

This document is provider-neutral unless a provider-specific capability is required.

The approved initial delivery model is:

```text
Static Caissa web application
        +
Independent Maia inference service
```

These products have separate deployment lifecycles and must be independently rollbackable.

---

## 2. Related Documents

This specification must remain consistent with:

- `00_product_identity.md`
- `01_prd.md`
- `02_ux_specification.md`
- `03_design_system.md`
- `04_technical_specification.md`
- `05_architecture_design.md`
- `06_ai_architecture.md`
- `07_testing_strategy.md`
- `09_coding_guidelines.md` — planned
- `10_security_and_privacy.md` — planned
- `11_project_roadmap.md` — planned

When conflicts occur, use this priority:

1. Chess correctness and user-data integrity
2. Security and privacy
3. Safe rollback and recoverability
4. Accessibility and supported-browser behavior
5. Testing and release gates
6. This deployment specification
7. Provider convenience

---

# 3. Release Philosophy

Caissa should be released conservatively.

A release is not successful merely because deployment completed.

A release is successful when:

- The correct artifacts were deployed
- The deployed version is observable
- Core gameplay remains correct
- Saved games remain compatible
- Maia behavior is version-identifiable
- itch.io packaging works in the real host
- Rollback is possible
- Users are not trapped in an unrecoverable state
- License obligations remain satisfied

The governing principle is:

> Build once where possible, verify the exact artifact, deploy deliberately, and preserve a path back.

---

# 4. Deployment Units

Caissa has two primary deployable units.

## 4.1 Caissa Web

A static Vite-generated browser application.

Responsibilities:

- Product UI
- Local game state
- IndexedDB persistence
- Stockfish browser worker
- Review experience
- API client
- Offline/degraded behavior

Deployment targets:

- Controlled static web hosting
- itch.io HTML5 hosting

## 4.2 Maia Service

A containerized FastAPI application.

Responsibilities:

- Maia model hosting
- Request validation
- Warm worker pool
- Human-like move inference
- Model and service metadata
- Health/readiness endpoints
- Metrics and structured logs

Deployment target:

- Container-capable cloud or VPS environment

## 4.3 Independent Release Rule

A web release must not require an immediate Maia redeploy unless the API contract changes.

A Maia release must remain compatible with the currently supported web clients.

---

# 5. Environment Model

Required environments:

| Environment | Purpose | Public? | Data Characteristics |
|---|---|---:|---|
| `local` | Developer execution | No | Disposable |
| `ci` | Automated verification | No | Synthetic |
| `preview` | Pull-request web preview | Restricted/public link | Synthetic or local |
| `maia-staging` | Real service integration | Restricted | Test requests |
| `web-beta` | Beta browser release | Limited | Local user data |
| `itch-private` | Private itch.io verification | Restricted | Local user data |
| `production-web` | Stable web release | Yes | Local browser data |
| `production-itch` | Stable itch.io release | Yes | Local browser data |
| `production-maia` | Stable Maia API | Yes through API | Minimal request context |

---

## 5.1 Environment Isolation

Each environment must have:

- Separate configuration
- Separate API base URL
- Separate secrets
- Separate deployment history
- Separate observability labels
- Explicit release channel
- Unique build metadata

Production secrets must never be made available to preview jobs.

## 5.2 Environment Protection

Production deployment environments should support:

- Restricted deployment branches or tags
- Required reviewer approval
- Environment-scoped secrets
- Deployment concurrency limits
- Auditable deployment history

---

# 6. Source-Control Release Model

## 6.1 Main Branch

`main` represents the latest integrated, releasable code.

It must remain protected.

Recommended protections:

- Pull requests required
- Required CI checks
- No direct push
- Required review
- Conversation resolution
- No force push
- Signed commits or verified contributors where practical

## 6.2 Release Tags

Stable releases use annotated semantic-version tags.

Examples:

```text
v0.1.0
v0.2.0-beta.1
v1.0.0
```

## 6.3 Hotfixes

Hotfix flow:

```text
production tag
    ↓
hotfix branch
    ↓
minimal change
    ↓
full relevant validation
    ↓
new patch release
    ↓
merge back to main
```

Never rewrite an existing release tag.

---

# 7. Versioning

## 7.1 Application Version

Caissa uses Semantic Versioning.

```text
MAJOR.MINOR.PATCH
```

Interpretation:

- **MAJOR:** incompatible product or saved-data behavior
- **MINOR:** backward-compatible capability
- **PATCH:** backward-compatible fix

Pre-release examples:

```text
0.4.0-alpha.2
0.8.0-beta.1
1.0.0-rc.1
```

## 7.2 Independent Component Versions

Track separately:

- Web application version
- Local database schema version
- API version
- Maia service version
- Maia model version/checkpoint
- Stockfish version/build
- Review rules version
- Explanation template version
- Design token version where needed

## 7.3 Build Identifier

Every artifact must contain:

```text
application version
Git commit SHA
build timestamp
release channel
target platform
```

Example:

```text
Caissa 0.7.0
commit: a1b2c3d
channel: beta
target: itch
```

## 7.4 User-Visible Version

The About or diagnostics screen should display:

- App version
- Build ID
- Stockfish version
- Maia service/model version when available
- Local schema version

---

# 8. Compatibility Policy

## 8.1 Web-to-API Compatibility

The Maia service should support at least:

- The current stable web release
- The immediately previous stable web release
- Active beta where practical

Breaking API behavior requires a new API version.

## 8.2 Saved-Data Compatibility

A new web release must:

- Read current schema
- Migrate supported previous schemas
- Preserve PGN when richer migration fails
- Avoid destructive downgrade assumptions

## 8.3 Model Compatibility

A Maia model change must not silently alter the meaning of an existing product profile without:

- Profile-version increment
- Benchmark comparison
- Release notes
- Stored provenance

---

# 9. Build Variants

Required web build variants:

| Variant | Purpose | Base Path | Maia Default |
|---|---|---|---|
| `web-preview` | PR review | Host-defined | Staging/disabled |
| `web-beta` | Controlled web beta | `/` or configured | Staging/production |
| `web-production` | Stable website | `/` | Production |
| `itch-private` | Private itch test | Relative | Staging/production |
| `itch-production` | Stable itch release | Relative | Production |
| `offline-smoke` | Local degradation test | Relative | Disabled |

## 9.1 Vite Base Configuration

The itch.io build must use a relative base:

```ts
base: "./"
```

or an equivalent approved relative configuration.

The controlled web build may use `/` or its known deployment base.

## 9.2 Build-Time Feature Flags

Build-time flags may include:

```text
VITE_RELEASE_CHANNEL
VITE_BUILD_TARGET
VITE_API_BASE_URL
VITE_ENABLE_MAIA
VITE_ENABLE_ANALYTICS
VITE_ENABLE_LIGHT_THEME
VITE_ENABLE_PWA
```

No secret may use the `VITE_` prefix.

---

# 10. Continuous Integration Pipeline

The default pull-request pipeline should run:

```text
checkout
    ↓
restore dependency caches
    ↓
install pinned dependencies
    ↓
validate generated files
    ↓
format check
    ↓
lint
    ↓
type check
    ↓
architecture checks
    ↓
unit and domain tests
    ↓
chess regression tests
    ↓
component tests
    ↓
Python service tests
    ↓
API contract tests
    ↓
security and license checks
    ↓
build web target
    ↓
build itch target
    ↓
browser smoke tests
    ↓
publish test reports/artifacts
```

## 10.1 Pipeline Requirements

- Fail fast on deterministic static errors.
- Run independent test jobs in parallel where safe.
- Upload failure traces.
- Preserve coverage reports.
- Record exact dependency lockfiles.
- Avoid downloading Maia models in normal pull-request CI.
- Use model stubs in standard CI.
- Use a separate real-model workflow.

## 10.2 CI Reproducibility

CI must use:

- Pinned action revisions or approved stable tags
- Pinned runtime versions
- Lockfile installation
- Clean build directories
- No undocumented local cache dependency

---

# 11. Continuous Delivery Pipeline

## 11.1 Preview Deployment

Every approved pull request may produce:

- Static web preview
- Build metadata
- Test report
- Bundle report

Preview should use:

- Non-production API
- No production secrets
- No production analytics
- Clear preview banner where appropriate

## 11.2 Beta Deployment

A beta tag or approved manual action may deploy:

- `web-beta`
- `maia-staging` or production-compatible API
- Private itch.io candidate

Beta deployment requires automated test success.

## 11.3 Stable Deployment

Stable release is tag-driven and manually approved.

Recommended sequence:

```text
create release candidate
    ↓
run complete release suite
    ↓
deploy production Maia if required
    ↓
verify Maia
    ↓
deploy production web
    ↓
verify web
    ↓
upload private itch candidate
    ↓
verify itch
    ↓
promote/publicize itch release
    ↓
publish release notes
```

A web-only release may skip Maia deployment when contracts remain compatible.

---

# 12. Artifact Strategy

## 12.1 Build Once Principle

For a given target, build the artifact once and promote the same artifact through verification and release where practical.

Do not rebuild a release artifact after approval without restarting qualification.

## 12.2 Required Artifacts

Web:

```text
caissa-web-<version>.tar.gz
caissa-itch-<version>.zip
asset-manifest.json
build-metadata.json
third-party-notices.txt
bundle-report.html
checksums.txt
```

Maia:

```text
container image
image digest
SBOM
model manifest
dependency lock
build metadata
license notices
checksums
```

## 12.3 Checksums

Release artifacts must include SHA-256 checksums.

## 12.4 Artifact Retention

Recommended minimum retention:

- Stable artifacts: indefinite or long-term
- Release candidates: 90 days
- Preview artifacts: 14–30 days
- Test reports: 30–90 days
- Security evidence: according to project policy

---

# 13. Static Web Deployment

## 13.1 Hosting Requirements

The controlled web host should support:

- HTTPS
- Immutable asset caching
- SPA fallback
- Custom headers
- Compression
- Atomic deployment
- Rollback
- Preview deployment
- Custom domain
- Access logs or metrics

## 13.2 Cache Policy

Recommended:

### Hashed assets

```text
Cache-Control: public, max-age=31536000, immutable
```

### `index.html`

```text
Cache-Control: no-cache
```

or a short policy that permits fast update detection.

### Engine files

Use versioned filenames and long-lived cache.

## 13.3 Compression

Serve:

- Brotli when supported
- Gzip fallback

Do not compress already compressed formats unnecessarily.

## 13.4 SPA Routing

> **Resolved by ADR-0005.** Caissa uses hash routing and relative asset paths, so no host
> rewrite rule is required on any target.


The host must route application paths to `index.html` while preserving real static assets.

## 13.5 Controlled Headers

Possible headers:

- Content Security Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Cross-Origin-Opener-Policy
- Cross-Origin-Embedder-Policy
- Cross-Origin-Resource-Policy

Cross-origin-isolation headers should be enabled only after all required assets and APIs are verified compatible.

---

# 14. itch.io HTML5 Packaging

> **Implemented.** `pnpm package:itch` builds and validates the archive, writing
> `dist-itch/caissa-itch.zip` and `dist-itch/itch-manifest.json`. The script enforces every
> limit in §14.3 and fails rather than producing an invalid upload. SharedArrayBuffer must
> stay disabled in the itch.io project settings; see ADR-0002.


## 14.1 Required Package Shape

The ZIP root must contain:

```text
index.html
assets/
...
```

The package must contain all files required by the game.

## 14.2 Required Properties

- File names are case-correct.
- Asset URLs are relative.
- No dependency assumes domain-root hosting.
- No local absolute filesystem path exists.
- External requests use HTTPS.
- No secret exists in the bundle.
- The app works inside an iframe or fullscreen launch.
- The package meets itch.io size and file-count constraints.

## 14.3 Package Validation Script

Create a release script that verifies:

```text
index.html exists at root
all referenced files exist
no absolute /assets path where disallowed
no http:// external URL
no environment secret pattern
case sensitivity
file count
uncompressed size
maximum file size
path lengths
license files
build metadata
```

## 14.4 Recommended Command

Conceptual command:

```text
pnpm release:itch
```

It should:

1. Clean output.
2. Build with itch target.
3. Validate output.
4. Run local static smoke.
5. Create ZIP.
6. Verify ZIP contents.
7. Generate checksum.
8. Emit release manifest.

## 14.5 itch.io Project Configuration

Recommended initial configuration:

- Kind: HTML
- Run in browser
- Click-to-launch fullscreen
- Responsive viewport
- Mobile support enabled only after real testing
- Page status: restricted/private during qualification
- Stable public status after sign-off

## 14.6 Update Strategy

Every upload must be labeled with:

```text
caissa-<version>-itch
```

Do not delete the previous stable upload until the new one passes production verification.

---

# 15. itch.io Release Procedure

## 15.1 Private Candidate

1. Build approved itch artifact.
2. Upload as a new restricted file.
3. Configure browser embedding.
4. Test desktop Chrome.
5. Test desktop Firefox.
6. Test mobile where supported.
7. Test fullscreen.
8. Test refresh and persistence.
9. Test Maia API.
10. Test single-thread Stockfish.
11. Test audio unlock.
12. Inspect browser console.
13. Confirm version metadata.
14. Record evidence.

## 15.2 Public Promotion

After sign-off:

- Mark the approved upload as active.
- Preserve prior stable artifact temporarily.
- Update version/changelog.
- Update screenshots only if needed.
- Publish release notes.
- Monitor errors and service metrics.

## 15.3 itch Rollback

Rollback procedure:

1. Restore or re-enable previous stable upload.
2. Remove the defective upload from public selection.
3. Verify launch.
4. Announce rollback if users were affected.
5. Preserve defective artifact for investigation.
6. Create incident and regression test.

---

# 16. Maia Container Build

## 16.1 Container Principles

The image must be:

- Reproducible
- Minimal enough for operations
- Non-root
- Pinned
- Model-identifiable
- Health-checkable
- Immutable in production
- Free of development tools where unnecessary

## 16.2 Build Strategy

Recommended stages:

```text
base runtime
    ↓
dependency installation
    ↓
application copy
    ↓
model download/cache
    ↓
hash verification
    ↓
non-root final runtime
```

The exact approach may be multi-stage if it reduces image size or attack surface.

## 16.3 Base Image

Use an official pinned Python image or approved digest.

Do not use `latest`.

## 16.4 Dependency Installation

- Copy dependency metadata before source for cache efficiency.
- Install exact resolved dependencies.
- Disable unnecessary package caches in final image.
- Record dependency manifest.

## 16.5 Model Cache

The approved model should be downloaded:

- During image build, or
- Through a controlled pre-deployment initialization process

The first user request must not trigger model download.

The checkpoint hash must be verified.

## 16.6 Runtime User

Run as a non-root user with only required filesystem permissions.

## 16.7 Filesystem

Prefer:

- Read-only application filesystem
- Explicit writable temporary directory
- Explicit model cache directory
- No persistent request data

---

# 17. Maia Runtime Deployment

## 17.1 Required Platform Capabilities

The host must support:

- Container deployment
- HTTPS ingress
- Health checks
- Automatic restart
- CPU and memory limits
- Environment secrets
- Deployment rollback
- Logs
- Metrics
- Scaling or instance resizing

## 17.2 Initial Topology

Start with:

```text
one service instance
one or small fixed warm-worker pool
one pre-cached Maia3-5M model
bounded request queue
```

Do not introduce Kubernetes solely for architectural appearance.

## 17.3 Resource Sizing

Sizing must be benchmark-driven.

Measure:

- Cold startup
- Warm memory per worker
- CPU per request
- P95 latency
- Queue behavior
- Worker restart cost

## 17.4 Health Probes

### Liveness

Confirms the API process responds.

### Readiness

Confirms:

- Model is available
- Worker pool initialized
- At least one worker ready
- Required configuration valid

Traffic must not reach an unready instance.

## 17.5 Graceful Shutdown

On termination:

1. Stop accepting requests.
2. Mark unready.
3. Wait for approved in-flight timeout.
4. Terminate model workers.
5. Flush logs/metrics.
6. Exit.

---

# 18. Maia Deployment Strategy

## 18.1 Rolling Replacement

For compatible releases:

- Start new instance
- Wait for readiness
- Shift traffic
- Observe
- Stop old instance

## 18.2 Blue-Green Option

For high-risk model or runtime updates:

```text
blue = current production
green = candidate
```

Verify green before traffic switch.

Keep blue available for rollback during the observation window.

## 18.3 Canary Option

Deferred until traffic volume justifies it.

If introduced:

- Send limited traffic
- Compare latency/error
- Compare model behavior metadata
- Do not mix profile semantics silently

---

# 19. Configuration Management

## 19.1 Configuration Categories

### Public web configuration

Safe to expose:

- API base URL
- Release channel
- Feature flags
- App version

### Maia runtime configuration

Server-only:

- Model ID
- Model cache path
- Worker count
- Device
- Allowed origins
- Rate limits
- Timeouts
- Logging level
- Metrics settings

### Secrets

- Deployment credentials
- Hosting API tokens
- Error-monitoring token
- Private registry credentials
- Optional analytics secret

## 19.2 Validation

Both web and service configuration must be schema-validated at startup/build.

Production should fail fast on missing required server configuration.

## 19.3 Configuration Drift

Production configuration should be tracked through:

- Infrastructure configuration
- Environment documentation
- Deployment logs
- Change review

Do not edit production configuration manually without recording the change.

---

# 20. Secrets Management

## 20.1 Rules

- Never commit secrets.
- Never place secrets in Vite client variables.
- Use environment-scoped secrets.
- Grant least privilege.
- Rotate compromised credentials immediately.
- Avoid printing secrets.
- Use short-lived cloud credentials where available.

## 20.2 GitHub Actions

Deployment jobs should use protected environments.

Production secrets become available only to approved production jobs.

## 20.3 Secret Inventory

Maintain a private inventory containing:

- Secret name
- Owner
- Purpose
- Environment
- Rotation policy
- Last rotation
- Revocation procedure

## 20.4 Repository Scanning

Run automated secret scanning and block confirmed exposures.

---

# 21. CI/CD Permissions

Workflows should receive minimum permissions.

Examples:

- Read repository content
- Write deployment status only when needed
- Publish package/image only in release workflow
- Use environment secrets only during deployment

Pull requests from untrusted forks must not receive production secrets.

---

# 22. Container Registry

If using a registry:

- Use immutable tags or digests.
- Publish semantic tag plus commit tag.
- Sign or attest images where practical.
- Scan images.
- Retain prior stable image.
- Do not deploy mutable `latest` as the authoritative version.

Example tags:

```text
caissa-maia:0.4.0
caissa-maia:sha-a1b2c3d
```

Production should deploy by digest where possible.

---

# 23. Software Bill of Materials

Each stable release should generate an SBOM for:

- Web dependencies
- Python dependencies
- Container base image
- Included engine/model artifacts where applicable

The SBOM should be retained with release artifacts.

---

# 24. License and Source Distribution

## 24.1 Stockfish

> **Resolved by ADR-0004.** Caissa is GPL-3.0-or-later. See `LICENSE`,
> `LICENSES/GPL-3.0.txt`, and `THIRD_PARTY_NOTICES.md`.


Release packaging must preserve applicable GPL notices and corresponding-source obligations for the distributed browser engine build.

Record:

- Upstream repository
- Exact commit/version
- Build method
- Distributed binaries
- Source location
- Modifications

## 24.2 Maia-3

The deployed Maia service uses AGPL-licensed software.

Before public deployment:

- Preserve notices.
- Publish corresponding covered source as required.
- Document modifications.
- Make source availability clear to network users.
- Retain the deployed revision.

## 24.3 Third-Party Notices

Every release must include or reference:

```text
THIRD_PARTY_NOTICES.md
LICENSES/
ASSET_MANIFEST.md
MODEL_MANIFEST.md
```

## 24.4 Release Gate

Missing required license material blocks release.

This document is not legal advice.

---

# 25. Database and Browser-Storage Release Safety

Caissa Version 1 uses local browser storage rather than a production server database.

## 25.1 Schema Migration Gate

Before web deployment:

- Migration tests pass.
- Prior-version fixture opens.
- PGN remains recoverable.
- New records use new schema.
- Corrupt optional data does not destroy a game.

## 25.2 No Automatic Downgrade Promise

A rollback to an older web build may not understand a newer local schema.

Therefore:

- Prefer backward-compatible schema changes.
- Delay irreversible migrations.
- Preserve raw PGN.
- Record rollback compatibility in release notes.

## 25.3 Expand-and-Contract Pattern

For schema evolution:

1. Add new fields while reading old and new.
2. Deploy.
3. Allow migration.
4. Remove old compatibility only in a later release.

---

# 26. API Release Safety

## 26.1 Backward Compatibility

Additive changes are preferred.

Examples:

- New optional response field
- New endpoint
- New profile ID with old profiles preserved

Breaking changes require `/api/v2` or equivalent.

## 26.2 Contract Validation

Before deploying Maia:

- OpenAPI diff reviewed
- TypeScript client contract tests pass
- Current stable web smoke passes
- Previous stable web compatibility smoke passes

## 26.3 Deprecation

Deprecated API behavior should have:

- Announcement
- Replacement
- End date
- Usage monitoring
- Removal release

---

# 27. Model Release Safety

A model or sampling-profile update is a product behavior release.

Required:

- New model/profile version
- Benchmark comparison
- Human playtest
- Latency test
- Memory test
- Legal-output test
- Release notes
- Rollback artifact

Do not replace a model behind the same identity without traceability.

---

# 28. Feature Flags

Feature flags support staged rollout.

Approved examples:

```text
maiaOpponent
advancedReview
lightTheme
pwaInstall
analytics
humanLikelihoodInsights
```

## 28.1 Rules

- Every flag has an owner.
- Every flag has a default.
- Every flag has an expiry/removal plan.
- Security must not depend on client flags.
- A disabled feature must not load unnecessary heavy assets.
- Production flag changes are recorded.

## 28.2 Kill Switches

Server-controlled or deployment-configurable kill switches should exist for:

- Maia requests
- Human-likelihood review
- Analytics
- Unstable advanced analysis

The local chess core must not require a remote kill switch.

---

# 29. Release Channels

## 29.1 Development

Unstable internal integration.

## 29.2 Alpha

Core flow incomplete or high risk.

Audience:

- Developers
- Selected testers

## 29.3 Beta

Feature-complete enough for broader testing.

Requirements:

- No known game-corruption defect
- Core regression suite passes
- Clear beta labeling

## 29.4 Release Candidate

No planned functional changes.

Only:

- Blocker fixes
- Documentation
- Release configuration

## 29.5 Stable

Approved for public use.

---

# 30. Release Cadence

Use milestone-driven releases rather than arbitrary frequent production pushes during early development.

Recommended:

- Preview on every pull request
- Beta as meaningful milestones stabilize
- Stable when quality gates pass
- Patch release for urgent defects

Do not promise a fixed cadence that compromises chess correctness.

---

# 31. Release Candidate Creation

A release candidate requires:

1. Version selected.
2. Changelog drafted.
3. Feature flags frozen.
4. Dependencies locked.
5. Model/engine versions frozen.
6. Database migration frozen.
7. CI passes.
8. Release artifacts built.
9. Checksums generated.
10. License bundle verified.
11. Candidate deployed to staging/private itch.
12. Verification begins.

Any code change after artifact creation requires a new candidate.

---

# 32. Release Approval Matrix

Recommended approval responsibilities:

| Area | Approver |
|---|---|
| Product scope | Product owner |
| Chess correctness | Chess/domain reviewer |
| Frontend quality | Frontend owner |
| Maia behavior | AI owner |
| Security/privacy | Security reviewer or owner |
| Accessibility | Accessibility reviewer |
| Operations | Deployment owner |
| Final release | Product owner + technical owner |

In a small team, one person may hold multiple roles, but each concern must still be reviewed explicitly.

---

# 33. Stable Release Checklist

## Product

- Scope matches release plan
- Known limitations documented
- Copy finalized
- Screenshots current

## Chess

- Regression suite passes
- PGN/FEN verified
- Clocks verified
- Restore verified

## AI

- Maia version recorded
- Stockfish version recorded
- Profile calibration approved
- Review sample approved
- Fallback verified

## Accessibility

- Keyboard flow passes
- Core screen-reader flow passes
- Contrast reviewed
- Reduced motion verified

## Performance

- Bundle budgets pass
- Engine startup measured
- Review performance measured
- Maia P95 acceptable

## Security

- Dependency scan passes
- Secret scan passes
- Container scan passes
- CORS verified
- Rate limits verified

## Deployment

- Web candidate verified
- Maia candidate verified
- itch private candidate verified
- Rollback artifacts available
- Monitoring ready

## Legal

- Third-party notices complete
- Model manifest complete
- Corresponding-source path recorded

---

# 34. Deployment Verification

Every deployment receives immediate smoke verification.

## 34.1 Maia Post-Deploy Smoke

Verify:

- Liveness
- Readiness
- Model metadata
- One known legal inference
- Invalid request rejection
- Latency
- Logs/metrics
- CORS from approved origin

## 34.2 Web Post-Deploy Smoke

Verify:

- Page loads
- Correct version
- New local game
- Legal move
- Local persistence
- Stockfish initialization
- Maia request
- Result screen
- PGN export
- No console error

## 34.3 itch Post-Upload Smoke

Verify:

- Correct upload active
- Launch
- Fullscreen
- Relative assets
- Audio
- Local persistence
- Single-thread engine
- Maia API
- Mobile where supported

---

# 35. Deployment Concurrency

Only one production deployment per deployable unit should execute at a time.

Use concurrency groups:

```text
production-web
production-itch
production-maia
```

A newer deployment may cancel an older pending deployment, but should not interrupt a production rollout mid-critical step without safe cleanup.

---

# 36. Rollback Strategy

## 36.1 Web Rollback

Rollback by restoring the prior immutable static artifact.

Risks:

- New local schema may not be readable by old app.
- New feature flags may be incompatible.
- API may have moved.

Mitigations:

- Backward-compatible migrations
- API compatibility
- Preserve PGN
- Record rollback compatibility

## 36.2 Maia Rollback

Rollback by deploying the prior container digest and model manifest.

Requirements:

- Prior image retained
- Prior configuration retained
- API remains compatible
- Health check passes before traffic shift

## 36.3 Feature Rollback

Use a kill switch when:

- The defect is isolated
- Core app remains safe
- Full artifact rollback is unnecessary

## 36.4 Rollback Decision

Rollback is preferred when:

- Game corruption occurs
- Illegal AI output is possible
- Primary browser is unusable
- Saved-data migration is unsafe
- Critical security issue exists
- Error rate spikes materially
- Maia latency makes games unusable

---

# 37. Forward Fix vs Rollback

## Rollback

Use when:

- Prior stable version is safe
- Compatibility permits it
- Incident impact is ongoing
- Fix cannot be verified immediately

## Forward Fix

Use when:

- Rollback would worsen data compatibility
- Defect is small and isolated
- A safe patch can be quickly verified
- Prior version has the same defect

The incident owner records the decision and rationale.

---

# 38. Recovery Time and Recovery Point

Initial objectives:

## Static Web

- Recovery Point Objective: none for server-side data; artifact history preserved
- Recovery Time Objective: restore prior artifact within a short operational window

## Maia Service

- RPO: no persistent user state
- RTO: restore healthy prior image or restart service promptly

## Browser Data

User-local data recovery depends on:

- Compatible app
- IndexedDB integrity
- PGN preservation
- Export capability

These are product requirements, not server backup guarantees.

---

# 39. Observability

## 39.1 Web Observability

Possible signals:

- Application errors
- Route failures
- Engine initialization errors
- Storage errors
- Unsupported capability
- Build version
- Performance metrics

Privacy rules apply.

## 39.2 Maia Observability

Required:

- Request count
- Status/error code
- P50/P95/P99 latency
- Queue wait
- Queue depth
- Ready workers
- Restarts
- CPU
- Memory
- Timeout
- Rate limit
- Invalid output

## 39.3 Release Markers

Every deployment should create a release marker in observability tools.

## 39.4 Alerting

Initial alerts:

- Maia readiness failed
- No ready workers
- Elevated error rate
- Elevated P95 latency
- Repeated worker restart
- Memory near limit
- Rate-limit saturation
- Web error spike after release

Alerts should be actionable and avoid excessive noise.

---

# 40. Operational Dashboards

Recommended dashboard sections:

## Service Health

- Uptime/readiness
- Requests
- Errors
- Latency
- Workers
- Resource usage

## Release Health

- Current versions
- Deployment times
- Error delta
- Latency delta
- Rollback status

## AI Health

- Requested profiles
- Model version
- Invalid-output count
- Timeout
- Queue saturation

## Client Health

- Supported browser distribution
- Engine-mode distribution
- Storage failure
- Crash/error events

---

# 41. Logging

## 41.1 Structured Logs

Required fields:

```text
timestamp
environment
service
version
request_id
status
duration_ms
error_code
model_id
worker_id
```

## 41.2 Privacy

Do not log by default:

- Full PGN
- Full move history
- Personal identity
- Email
- Raw IP beyond operational policy
- Secrets
- Authorization headers

## 41.3 Retention

Define retention according to:

- Operational usefulness
- Cost
- Privacy
- Incident investigation

---

# 42. Incident Management

## 42.1 Incident Triggers

Examples:

- Game state corruption
- Illegal moves accepted
- Maia illegal output
- Major outage
- Data-loss migration
- Security exposure
- Widespread startup failure
- Broken itch release

## 42.2 Incident Roles

At minimum:

- Incident owner
- Technical responder
- Communication owner

One person may fill multiple roles in a small team.

## 42.3 Incident Workflow

```text
detect
    ↓
assess severity
    ↓
contain
    ↓
rollback or mitigate
    ↓
verify recovery
    ↓
communicate
    ↓
investigate root cause
    ↓
add regression test
    ↓
publish post-incident review
```

## 42.4 User Communication

Communication should be:

- Honest
- Specific
- Calm
- Clear about impact
- Clear about recovery
- Free of unsupported claims

---

# 43. Incident Severity

## SEV-0

Immediate critical risk:

- Security breach
- Destructive data corruption
- Illegal gameplay at scale

## SEV-1

Major production failure:

- Core game unusable
- Maia outage without fallback
- itch release broken
- Primary browser failure

## SEV-2

Degraded significant capability:

- Review unavailable
- Increased latency
- Non-primary browser issue
- Partial settings/persistence issue

## SEV-3

Minor operational issue:

- Cosmetic release defect
- Low-impact telemetry issue
- Documentation mismatch

---

# 44. Maintenance Mode

The Maia service may expose a controlled maintenance response.

The web application should respond with:

- Local play remains available
- Stockfish fallback when possible
- Clear status
- Retry option

Do not put the entire static app into maintenance mode solely because Maia is unavailable.

---

# 45. Dependency and Runtime Updates

## 45.1 Routine Update

For normal dependencies:

- Review changelog
- Update lockfile
- Run full relevant suite
- Check bundle/image impact
- Deploy preview
- Release normally

## 45.2 High-Risk Update

High-risk examples:

- React major
- Vite major
- chess.js major
- IndexedDB/Dexie major
- Stockfish build change
- Maia package/model change
- Python major
- Container base major

Require:

- ADR or upgrade note
- Expanded regression
- Migration review
- Performance comparison
- Rollback plan

## 45.3 Security Patch

Security patches may be expedited but never skip minimum verification for chess and persistence safety.

---

# 46. Backups and Retention

## 46.1 Source

Repository hosted with protected history.

Optional mirrored backup may be maintained.

## 46.2 Artifacts

Retain stable artifacts and image digests.

## 46.3 Configuration

Back up:

- Deployment configuration
- Environment-variable names
- Infrastructure definitions
- Release manifests

Do not store raw secrets in ordinary backups.

## 46.4 User Data

Version 1 does not centrally own user game history.

The product must provide export, but the service does not promise cloud backup.

---

# 47. Disaster Recovery

Scenarios:

## Hosting Loss

- Deploy static artifact to alternate host.
- Update DNS.
- Verify API allowlist/CORS.

## Maia Host Loss

- Deploy last stable image to alternate container host.
- Configure model cache.
- Update API routing.
- Verify readiness.

## Registry Loss

- Rebuild from pinned source and lockfiles.
- Verify hashes and tests.
- Restore from retained artifact if available.

## Source Hosting Loss

- Restore from repository mirror/backup.
- Recreate CI secrets.
- Revalidate deployments.

A disaster-recovery rehearsal should be performed before stable Version 1 when practical.

---

# 48. Release Notes

Every stable release should include:

- Version
- Date
- Highlights
- New features
- Improvements
- Bug fixes
- AI/model changes
- Known limitations
- Compatibility notes
- Credits
- Source/license information where relevant

Avoid vague lines such as:

```text
Various fixes and improvements
```

when meaningful changes can be stated.

---

# 49. Changelog

Maintain `CHANGELOG.md`.

Recommended structure:

```text
Added
Changed
Fixed
Deprecated
Removed
Security
AI and Model
```

Unreleased changes should be collected before release.

---

# 50. Public Status and Support

Before a public stable release, define:

- Support contact or issue tracker
- Known-issue location
- Privacy notice
- AI limitation notice
- Source-code links required by licenses
- Version display
- Bug-report instructions

A formal public status page is optional initially.

---

# 51. Bug Report Metadata

Encourage reports to include:

- App version
- Build target
- Browser/device
- Stockfish mode
- Maia availability
- Steps
- Screenshot
- PGN where user chooses to share it

Do not request sensitive information unnecessarily.

---

# 52. Release Automation Scripts

Recommended scripts:

```text
pnpm verify
pnpm build:web
pnpm build:itch
pnpm validate:itch
pnpm package:itch
pnpm release:manifest
pnpm licenses:verify
pnpm smoke:web
pnpm smoke:itch
```

Python/service scripts:

```text
make test
make build-image
make verify-model
make smoke-service
make benchmark
make release-manifest
```

Scripts must be deterministic and documented.

---

# 53. Release Manifest

Every release should produce a machine-readable manifest.

Example:

```json
{
  "appVersion": "0.8.0",
  "commit": "a1b2c3d",
  "buildTarget": "itch",
  "buildTime": "2026-07-10T10:00:00Z",
  "schemaVersion": 3,
  "stockfish": {
    "version": "recorded-version",
    "buildHash": "recorded-hash",
    "mode": "single-thread-capable"
  },
  "maia": {
    "apiVersion": "v1",
    "minimumServiceVersion": "0.3.0",
    "profileVersion": "1"
  }
}
```

---

# 54. Source Maps

Source-map policy:

- Generate source maps for controlled diagnosis.
- Do not expose sensitive source content or secrets.
- Public availability depends on error-monitoring strategy.
- Retain maps matching every stable artifact.
- Verify release tooling cannot mismatch maps and deployed bundles.

---

# 55. Analytics Release Safety

If analytics are enabled:

- Confirm disclosure.
- Confirm opt-out where applicable.
- Confirm no full PGN by default.
- Confirm no gameplay blocking.
- Confirm production key is environment-scoped.
- Confirm preview does not pollute production analytics.

Analytics may be disabled with a flag.

---

# 56. PWA Release Safety

PWA support is optional.

If introduced:

- Test cache invalidation.
- Avoid trapping users on stale incompatible app versions.
- Version service-worker caches.
- Preserve migration safety.
- Provide update prompt.
- Verify itch.io behavior separately; itch.io distribution does not require PWA installation.

Do not add a service worker before cache strategy is tested.

---

# 57. Release Security Review

Before Version 1 stable:

- Threat review complete
- Secrets reviewed
- CSP reviewed
- CORS reviewed
- API limits reviewed
- Container user reviewed
- Dependency scans clean
- Model provenance verified
- Source/license obligations verified
- Import sanitization tested
- Logs reviewed for privacy

---

# 58. Release Accessibility Review

Before stable:

- Keyboard-only game completed
- Promotion completed
- Review navigated
- Screen-reader core flow tested
- Focus restoration verified
- Reduced motion verified
- Mobile touch targets verified
- Contrast verified

---

# 59. Performance Release Review

Before stable:

- Web bundle measured
- LCP/CLS/INP measured
- Stockfish startup measured
- Main-thread long tasks reviewed
- Maia P95 measured
- Review time measured
- Memory soak performed
- itch.io load tested

---

# 60. Post-Release Observation

Recommended observation window after stable deployment:

- Closely observe initial release period
- Compare errors to baseline
- Check Maia readiness and latency
- Check worker restart
- Verify itch page manually
- Confirm no migration spike
- Review bug reports
- Avoid unrelated immediate deployments unless necessary

---

# 61. Post-Release Review

After a meaningful release, record:

- What shipped
- Test evidence
- Deployment duration
- Incidents
- Rollbacks
- User feedback
- Performance
- AI behavior changes
- Process improvements

This is a lightweight operational review, not bureaucracy for its own sake.

---

# 62. Initial CI/CD Implementation Plan

## Phase 1 — CI Foundation

- Protected main
- Node/Python setup
- Lint
- Type check
- Unit/domain tests
- Build web
- Build itch

## Phase 2 — Quality Gates

- Chess regression
- Component tests
- Contract tests
- Security scan
- License scan
- Architecture checks

## Phase 3 — Preview

- PR preview
- Build metadata
- Browser smoke
- Artifact retention

## Phase 4 — Maia Staging

- Container build
- Registry
- Staging deploy
- Health/readiness
- Real-model smoke

## Phase 5 — Production Web

- Protected environment
- Atomic static deploy
- Rollback
- Release marker

## Phase 6 — itch.io

- Automated package validation
- Private upload procedure
- Manual promotion
- Rollback procedure

## Phase 7 — Production Operations

- Metrics
- Alerts
- Incident process
- Release dashboard
- Disaster recovery

---

# 63. Codex Deployment Task Protocol

Every deployment-related Codex task must define:

- Target environment
- Allowed workflow files
- Required permissions
- Secrets used by name only
- Build target
- Validation commands
- Artifact names
- Rollback behavior
- Security restrictions

Example:

```text
Create the itch.io packaging script described in
08_deployment_and_release.md sections 14 and 52.

Requirements:
- Build with Vite relative base.
- Verify index.html is at archive root.
- Reject absolute /assets references.
- Reject http:// URLs.
- Verify file count and sizes.
- Include build metadata and third-party notices.
- Generate SHA-256 checksum.
- Do not upload anything.
- Add automated tests for invalid packages.
```

Codex must not:

- Add secrets to repository files
- Grant broad workflow permissions
- Deploy automatically from untrusted pull requests
- Use mutable image tags as the only production identity
- Delete prior stable artifacts during initial rollout
- Disable failing release gates to complete deployment

---

# 64. Locked Deployment Decisions

The following are approved:

1. Web and Maia are independently deployable.
2. The web application is statically hosted.
3. itch.io receives a dedicated relative-path build.
4. Maia is deployed as a container.
5. The first production Maia topology is intentionally simple.
6. Stable releases are tag-driven and manually approved.
7. Production environments use scoped secrets and protection.
8. Release artifacts are immutable and checksummed.
9. Stable image deployment uses a version or digest, not only `latest`.
10. Maia models are pre-cached before readiness.
11. The first user request never downloads a model.
12. Private itch.io upload testing is mandatory.
13. Prior stable web and Maia artifacts are retained for rollback.
14. Database migrations are reviewed as release-risk changes.
15. Model/profile changes are versioned product releases.
16. License/source notices are release gates.
17. Deployment verification is performed after every production release.
18. Observability includes release markers.
19. Core local chess remains available during Maia outages.
20. No release is approved based solely on successful CI deployment.

---

# 65. Open Deployment Decisions

Resolve before implementation or stable release:

1. Static web hosting provider
2. Maia container hosting provider
3. Container registry
4. Error-monitoring provider
5. Metrics/logging provider
6. DNS and domain
7. Exact retention periods
8. Exact production approval roles
9. Exact GitHub Actions workflow structure
10. Exact container CPU/memory
11. Exact worker count
12. Exact CORS production origins
13. Whether threaded Stockfish ships on controlled web
14. Whether analytics ships
15. Whether PWA ships
16. Exact itch.io uploader automation, if any
17. Whether image signing/attestation is required for Version 1
18. Exact disaster-recovery alternate host
19. Exact public support channel
20. Exact incident-notification process

---

# 66. Deployment Acceptance Criteria

This specification is implementation-ready when:

- Deployable units are defined.
- Environments are defined.
- Build variants are defined.
- CI and CD stages are defined.
- itch.io packaging rules are defined.
- Maia container requirements are defined.
- Configuration and secrets are separated.
- Version and artifact policies are defined.
- Compatibility and migration policies are defined.
- Rollback paths exist.
- Monitoring and incident handling are defined.
- Release gates and approval are defined.
- License packaging is defined.
- Codex deployment constraints are defined.

---

# 67. Definition of Done for Deployment Infrastructure

Deployment infrastructure is complete when:

1. A clean checkout produces reproducible web and itch builds.
2. The itch ZIP passes automated validation.
3. Web preview deployment works.
4. The Maia image builds with pre-cached verified model.
5. Maia staging reports healthy and ready.
6. The real web client can call staging Maia.
7. Protected production environments exist.
8. Production secrets are environment-scoped.
9. Stable artifacts and image digests are retained.
10. Static web rollback is tested.
11. Maia rollback is tested.
12. Release metadata is visible.
13. Logs and metrics identify deployed versions.
14. License and model manifests are included.
15. A private itch.io release passes the full smoke checklist.
16. Incident and rollback procedures are documented and rehearsed.

---

# 68. Definition of Done for a Stable Release

A stable Caissa release is complete when:

1. The release commit is tagged.
2. Required CI and release suites pass.
3. Release artifacts are built once and checksummed.
4. The Maia service is compatible and healthy.
5. The web deployment is verified.
6. The private itch.io candidate is verified.
7. Accessibility sign-off is complete.
8. Chess/domain sign-off is complete.
9. AI/model sign-off is complete.
10. Security and license reviews are complete.
11. Rollback artifacts are available.
12. Changelog and release notes are published.
13. Build and model provenance are recorded.
14. Production monitoring shows no release-blocking regression.
15. The exact released version can be reproduced or restored.

---

# 69. Primary Reference Basis

This specification reflects current official guidance available at preparation time.

## itch.io HTML5 Distribution

Official itch.io creator documentation:

`https://itch.io/docs/creators/html5`

Key operational requirements include a root `index.html` for ZIP uploads, case-sensitive filenames, relative paths, and browser embed configuration.

## Vite Production Build

Official Vite production-build documentation:

`https://vite.dev/guide/build`

Vite supports relative output paths through a relative `base` configuration, which is required for unknown or embedded deployment bases such as itch.io.

## FastAPI Container Deployment

Official FastAPI deployment documentation:

`https://fastapi.tiangolo.com/deployment/docker/`

Container deployment supports reproducible packaging and standard runtime health, restart, resource, and startup patterns.

## GitHub Actions Deployment Environments

Official GitHub documentation:

`https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment`

Deployment environments support scoped secrets, protection rules, reviewers, branch restrictions, and deployment history.

Exact provider behavior must be reverified at implementation and release time.

---

# 70. Final Deployment Direction

Caissa’s release system should not be impressive because it contains many workflows.

It should be trustworthy because every released artifact is known, tested, reversible, and attributable.

The final operational principle is:

> The browser experience must be easy to ship, the AI service must be safe to replace, and every release must leave a clear path back.

A release is not merely a new version.

It is a controlled promise that the game, the player’s progress, and the product’s integrity remain protected.
