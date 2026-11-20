# Authenticated end-to-end scope

| Field | Detail |
|---|---|
| Status | **Implemented — dedicated project `vebqfgiqxfwfahwzsjkh`** |
| Date | 2026-11-19 |
| Owner question | Which Supabase backend should the authenticated suite run against? |
| Related | `docs/AI_HANDOVER.md` section 6; `playwright.config.ts`; `supabase/seed/demo-tenant.sql` |

## 1. Why this exists

The current Playwright suite is deliberately unconfigured: `playwright.config.ts` blanks the Supabase variables so 7 tests can assert the signed-out, setup and validation states deterministically. That is the right default for every push, but it proves nothing about RLS, posting, stock or money.

Everything critical has therefore been verified manually with ad-hoc Playwright scripts against the non-production project: master-data lifecycle, batch capture, three-way match, fleet, impersonation and access changes. Those checks are repeatable only by an agent who knows the scripts and the cleanup order.

Unit tests cover **180** rules, including the matching engine, validation and tenant resolution. They do not cover a real browser session, RLS, server actions or cross-module effects.

## 2. Goal and non-goals

**Goal:** a second, opt-in browser suite that runs the highest-risk flows against a real Supabase backend with deterministic fixtures, safe cleanup and a CI path.

**Non-goals:** load or performance testing, visual regression, email delivery, offline posting (DR-09), production data, statutory accounting.

## 3. Backend options

| Option | Isolation | Setup cost | CI | Notes |
|---|---|---|---|---|
| **A. Dedicated Supabase project** (recommended) | Strong: own URL, keys, data | Apply migrations, seed fixtures, create 3 auth users | Repository secrets | A mistake cannot touch demo or tenant data. Free tier is sufficient. |
| B. Existing non-production project, dedicated `ORG-E2E` tenant | Medium: shared database, separate tenant | Seed tenant, roles, locations and users | Repository secrets | Fastest to start, but a bad cleanup or policy bug can reach demo data. |
| C. Local Supabase stack (Docker) | Strong | Supabase CLI + Docker on every machine | Poor: not available on hosted runners without extra services | Useful for offline development only. |

**Recommendation:** **A**, with **B** acceptable as an interim if creating a project is slow. The suite must refuse to run unless `E2E_ALLOWED_PROJECT_REF` matches the configured project ref. It must also refuse to run when the URL matches the current demo project unless the caller explicitly opts in with `E2E_ALLOW_DEMO_PROJECT=1`.

## 4. Fixtures

A separate tenant, never Alpha and never Beta:

| Fixture | Value |
|---|---|
| Organisation | `ORG-E2E`, display name "E2E Tenant", active |
| Location | `E2E-DEPOT`, active |
| Roles | `Administrator` (all permissions), `E2E Viewer` (`*.view` only), optional `Platform` |
| Users | `e2e.owner@…` (Administrator), `e2e.viewer@…` (viewer), `e2e.platform@…` (platform admin, MFA disabled for the test project only) |
| Master data | supplier `E2E-SUP`, depot, product `E2E-PMS`, customer `E2E-CUS`, transporter, truck `E2E-TRK`, compartment, driver |
| Optional order | `E2E-PO-1` with one line, so matching has a stable starting point |

Seeded rows use the `E2E-` prefix. Per-run records use `E2E-<runId>-…` so parallel or overlapping runs cannot collide.

Auth users cannot be created by plain SQL safely; a setup script creates them with the service role and writes profiles, roles and grants. The seed file should stay idempotent.

## 5. Authentication strategy

Reuse the proven pattern: service-role `generateLink` → `/auth/v1/verify` → inject the `sb-<ref>-auth-token` cookie into the browser context. This avoids password flows, MFA prompts and the auth rate limiting that has already broken scripted sign-in (`429 over_request_rate_limit`).

Rules:

- The service-role key is used only in global setup and cleanup, never in page code or browser context.
- One storage state per role, created once per run, or a fixture that builds the cookie per worker.
- `fullyParallel: false` for the authenticated suite; auth and platform flows are order-sensitive.
- Test-only users may have MFA disabled; document that this applies only to the dedicated test project.

## 6. Test matrix

| Priority | Flow | Key assertions | Data touched |
|---|---|---|---|
| **P0** | Capture a batch with invoice price, then open Matching | Quantity chain, invoice rate, price delta, status `Matched` or `Price variance` | One PO line, one batch |
| **P0** | Master-data lifecycle | Create → edit → deactivate → hidden from new-document select → reactivate | One supplier |
| **P0** | Read-only role | Data visible, zero Edit/Deactivate controls, no create forms | Viewer session only |
| **P1** | Loading → delivery → trip P&L | Loaded/delivered quantities, delivery status, contribution and data gaps | One trip, loading, delivery |
| **P1** | Trip closure policy | `warn` allows closure, `block` refuses unresolved items, override needs reason | One trip, one reconciliation |
| **P1** | Invite + deactivate member | Profile and role created, deactivation blocks sign-in, reactivation restores it | One auth user |
| **P1** | Impersonation | Banner, target sidebar, one write as target, exit, audit start/end | One member and platform admin |
| P2 | PWA shell and offline fallback | Manifest, service worker, `/offline` | None |
| P2 | Printable waybill / invoice | Print route renders expected references | None |

Start with the three P0 tests. They cover the flows that have caused the most manual verification so far.

## 7. Harness shape

```
playwright.auth.config.ts        # real env, no webServer env override, serial
tests/e2e-auth/global-setup.ts   # project guard, QA users, roles, grants
tests/e2e-auth/fixtures.ts       # signed-in context per role, service client
tests/e2e-auth/cleanup.ts        # prefix-based teardown, fail on leftovers
tests/e2e-auth/matching.spec.ts
tests/e2e-auth/master-data.spec.ts
tests/e2e-auth/read-only.spec.ts
```

Scripts:

```json
"test:e2e:auth": "playwright test -c playwright.auth.config.ts",
"test:e2e:auth:ui": "playwright test -c playwright.auth.config.ts --ui"
```

The authenticated suite should run against a production build (`next build` + `next start`) to avoid dev compilation noise. The default suite stays on dev with blank env.

## 8. Safety and cleanup

- **Guard first:** abort if `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY` or `E2E_SUPABASE_SERVICE_ROLE_KEY` is missing, or if the project ref is not in `E2E_ALLOWED_PROJECT_REF`.
- **No demo writes:** fixtures live in the E2E tenant; tests never select Alpha/Beta by name.
- **Prefix cleanup:** every created row carries the run prefix; `afterAll` deletes in FK order (batch → line → link → master). Cleanup failures fail the run.
- **No hard delete in the UI:** cleanup uses the service role; the product still has no delete path.
- **Artifacts:** trace, screenshot and video retained on failure; service-role keys never printed.
- **Audit:** test writes will create audit rows. They are acceptable in a dedicated project; in option B they are unavoidable and must be called out.

## 9. CI plan

Add a separate job, not part of the existing green path:

| Trigger | Behaviour |
|---|---|
| Repository secrets absent | Job skips with a clear message; existing CI unchanged |
| Secrets present | Apply migrations (or assert they are current), run the authenticated suite, upload artifacts |
| Schedule | Nightly, so a flaky external dependency never blocks a PR |
| Manual | `workflow_dispatch` for before-release checks |

Required secrets: `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_ALLOWED_PROJECT_REF`. Optionally `E2E_TEST_USER_EMAIL` if the owner account is project-specific.

Do not put the service-role key in a client-visible environment variable, and do not run this job on forked pull requests.

## 10. Open decisions for the owner

1. ~~**Backend:** dedicated project (A) or the existing project with an E2E tenant (B)?~~ Resolved 2026-11-19: dedicated project `vebqfgiqxfwfahwzsjkh`.
2. **Ownership:** who creates and owns the test project and its secrets?
3. **Impersonation in CI:** keep the platform-admin/MFA flow in the suite, or test it only locally?
4. **Retention:** how long should E2E artifacts and audit rows be kept?
5. **PR gating:** nightly only, or also required before merging a release branch?

## 11. Effort

| Piece | Estimate |
|---|---|
| Project or tenant fixtures + guard + auth fixture | 3-4 h |
| P0 tests (matching, master data, read-only) | 4-6 h |
| P1 tests (delivery/trip, closure, invite, impersonation) | 1-2 days |
| CI job + secrets documentation | 2-3 h |

The P0 slice is roughly **one working day** after the backend exists.

## 12. Proposed first slice

1. Create or designate the backend, apply migrations, seed `ORG-E2E`.
2. Land the harness, guard, auth fixture and the three P0 tests.
3. Run locally against a production build and prove cleanup.
4. Add the secrets-gated CI job and a short runbook.

Nothing in this scope changes application behaviour. The only production code touched would be if a test exposes a real defect.

## 13. Implementation note — 2026-11-19

**Backend:** the dedicated project is live: **PetroCore Supply E2E**, ref `vebqfgiqxfwfahwzsjkh`, region `eu-west-1`, in the PetroCore-Supply organisation. It was created after pausing `Resturant and Bar` freed a free-plan slot. All migrations through `20261119000200` are applied, `supabase/seed/e2e-tenant.sql` is seeded, and the three P0 specs pass against it.

The earlier interim **`ORG-E2E`** tenant in `pmsjntbwtswjygerozns` still exists but is unused. It can be removed later; it is not referenced by the suite or the CI workflow.

**Files:**

| File | Purpose |
|---|---|
| `supabase/seed/e2e-tenant.sql` | Idempotent tenant, roles, location and fixtures (`E2E-SUP`, `E2E-PMS`, `E2E-PO-1`, truck, driver, customer) |
| `tests/e2e-auth/env.ts` | `.env.e2e.local` loader, required variables and the project guard |
| `tests/e2e-auth/global-setup.ts` | Tenant check, auth users/profiles/roles, session minting and interrupted-run recovery |
| `tests/e2e-auth/session.ts` | Cached owner/viewer sessions under the gitignored `.auth/` |
| `tests/e2e-auth/fixtures.ts` | Cookie injection, service client, select-by-text helper |
| `tests/e2e-auth/master-data.spec.ts` | Create → edit → deactivate → hidden from PO options → reactivate |
| `tests/e2e-auth/matching.spec.ts` | Batch with invoice price → `Price Variance`, `+50.00`, `+50,000.00` |
| `tests/e2e-auth/read-only.spec.ts` | Viewer sees data with no management controls |
| `playwright.auth.config.ts` | Real env, serial workers, reuses the running dev server |
| `.github/workflows/e2e-auth.yml` | Nightly/manual job, skips cleanly without secrets |

**Run locally:**

```bash
# once, against the configured project
# apply supabase/seed/e2e-tenant.sql in the SQL editor or with the Management API

cp .env.e2e.example .env.e2e.local
# fill the URL, anon key, service key and ref; set E2E_ALLOW_DEMO_PROJECT=1 only
# for the interim ORG-E2E tenant

npm run test:e2e:auth
```

Global setup creates `e2e.owner@…` with Administrator and `e2e.viewer@…` with view-only permissions, then mints both sessions once and caches them. Tests never call the auth endpoint per test, so a flaky link endpoint cannot fail an individual spec.

**Safety:** the guard rejects any ref outside `E2E_ALLOWED_PROJECT_REF`, and rejects the demo project unless `E2E_ALLOW_DEMO_PROJECT=1`. Global setup recovers only `E2E-RUN-` records in `ORG-E2E`; cleanup runs in `afterAll` and deletes by unique code/batch number.

**CI:** the workflow reads `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY` and `E2E_ALLOWED_PROJECT_REF` from repository secrets and skips when they are absent. The E2E seed must be applied once to the target project. It deliberately does not set `E2E_ALLOW_DEMO_PROJECT`, so a shared project cannot be used by CI accidentally.

**Known limitation:** during the first implementation run, Supabase connectivity from the development machine was intermittent (10-second connect timeouts), which redirected some authenticated requests to `/login`. The suite now mints both sessions once in global setup, caches them under the gitignored `tests/e2e-auth/.auth/`, and tests reuse the cookies. With connectivity restored, the full suite passed **3/3** against the dedicated project on 2026-11-19 in 1.3 minutes, and the database held no `E2E-RUN-` records afterwards. A stable network is still required; the CI job is nightly/manual for that reason.
