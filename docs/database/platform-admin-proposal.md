# Platform Super Admin and Tenant Switching — Proposal

**Status:** Design proposal. **No SQL has been applied and no platform capability exists.**  
**Draft migration:** `supabase/migrations-draft/0004_platform_admin.sql` (not executable by tooling).  
**Decision record:** DR-26 in the Decision Register.  
**Prepared:** 2026-11-15.

## 1. Why a separate design is required

D-003 requires a platform-level Super Admin that:

- is not an ordinary member of any tenant;
- enters a tenant only through a privileged, server-validated switch;
- has every entry and exit audited;
- never weakens ordinary tenant RLS.

D-001 already forbids ordinary users from holding multiple memberships or switching tenant, so Super Admin cannot be modelled as "a member of every tenant". It needs its own identity, session and audit path.

## 2. Recommended design

| Concern | Recommendation |
|---|---|
| Identity | New `platform_admins` table keyed by `auth.users.id`. No tenant membership. Not a profile. |
| Bootstrap | First row inserted by the database owner with documented SQL; no self-service elevation. |
| Authorisation | Active row in `platform_admins` **and** an MFA-authenticated session (AAL2). |
| Switch | Server action creates a `platform_tenant_sessions` row (30-minute expiry) and sets a signed, httpOnly cookie containing only the session id. |
| Tenant context | Resolved server-side from the session row. A tenant id in the URL or body is never trusted on its own. |
| Data access | Server-side Supabase client using the service-role key, explicitly scoped with `.eq("organisation_id", session.organisation_id)`. Read-only in v1. |
| Writes | Denied in v1. Any future write requires a new decision, separate approval and an explicit audit action. |
| Exit | Server action ends the session, audits the exit and clears the cookie. Expired sessions are treated as ended. |
| Audit | New append-only `platform_audit_logs`: enter, exit, denied attempt, expired session, bootstrap grant/revoke. |
| Visibility | Platform audit is visible only to platform administrators. Tenant audit remains separate. |
| RLS | New tables have RLS enabled with **no** policies for `anon`/`authenticated`; only the service role reaches them. Existing tenant policies are unchanged. |

## 3. Threat model and controls

| Threat | Control |
|---|---|
| Ordinary tenant user escalating | No insert/update path to `platform_admins` for tenant roles; service-role only; no UI. |
| Stolen browser session | httpOnly, secure, same-site cookie; server-side session row with expiry and revocation; exit ends it. |
| Forged tenant id | Session row is the only source of the tenant context; request-supplied ids are ignored. |
| Service-role misuse | Key used only in the platform module; every query scoped to the session tenant; read-only; code-reviewed. |
| Silent cross-tenant access | Entry, exit and denial audited; tenant-facing admins can be shown platform access events in a later iteration. |
| Audit tampering | `platform_audit_logs` append-only trigger; no update/delete policy; only service role writes. |
| Elevation without MFA | Switch action checks `getAuthenticatorAssuranceLevel()` and refuses anything below `aal2`. |
| Long-lived access | 30-minute expiry, explicit exit, and revocation of the admin row takes effect immediately. |
| Orphaned access after staff change | Revoking the admin row blocks new switches; active sessions must also be ended (documented operational step). |

## 4. Data model

### `platform_admins`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `auth_user_id` | uuid | unique, FK `auth.users` |
| `status` | varchar(20) | `active` or `revoked` |
| `mfa_required` | boolean | default true |
| `granted_by` | uuid | auth user who granted; nullable for bootstrap |
| `granted_at` | timestamptz | |
| `revoked_at` | timestamptz | |
| `notes` | text | reason for access |

No `organisation_id`: this is a deliberate platform-global table and must be documented as an exception under DR-24.

### `platform_tenant_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK; the value stored in the cookie |
| `platform_admin_id` | uuid | FK `platform_admins` |
| `organisation_id` | uuid | FK `organisations`; the switched tenant |
| `issued_at` | timestamptz | |
| `expires_at` | timestamptz | `issued_at + 30 minutes` |
| `ended_at` | timestamptz | |
| `ended_reason` | varchar(40) | `exit`, `expired`, `revoked` |
| `reason` | text | why the admin entered |

### `platform_audit_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `platform_admin_id` | uuid | FK |
| `organisation_id` | uuid | nullable for platform-level events |
| `action` | varchar(80) | `platform.tenant_entered`, `platform.tenant_exited`, `platform.switch_denied`, `platform.session_expired`, `platform.admin_granted`, `platform.admin_revoked` |
| `metadata` | jsonb | request context, reason, result |
| `created_at` | timestamptz | |

Append-only trigger; no update/delete policy.

## 5. Request flow

1. User signs in normally.
2. On `/platform`, the server verifies: Supabase session, `platform_admins.status = 'active'`, and AAL2.
3. The admin selects a tenant and provides a reason.
4. Server inserts a `platform_tenant_sessions` row, writes `platform.tenant_entered`, sets the cookie, redirects to `/platform/tenant`.
5. Tenant pages for that session use the service-role client scoped to `session.organisation_id`; every read is explicitly filtered.
6. Exit writes `platform.tenant_exited`, sets `ended_at`, clears the cookie.
7. Expired or missing session redirects `/platform` with no tenant data disclosed.

## 6. Why not RLS-based switching

RLS policies cannot see an httpOnly cookie, so a switched tenant cannot be represented to PostgREST without minting a custom JWT or per-request GUC. Both widen the attack surface and complicate every policy. Keeping platform access in a server-side service-role path with explicit scoping is narrower and leaves tenant RLS untouched — provided the service key never reaches the browser and every query is scoped and audited.

## 7. Explicit non-goals for v1

- No platform writes to tenant data.
- No impersonation of a tenant user or "sign in as".
- No access to tenant audit logs beyond what the platform audit records.
- No self-service platform admin creation.
- No bulk export.

## 8. Bootstrap and operations

- The first platform admin is inserted by the database owner after creating the auth user.
- Grant and revoke are documented SQL operations, each followed by a `platform.admin_granted`/`platform.admin_revoked` audit row.
- Revoking an admin must also end active sessions (the revoke SQL should do both in one transaction).
- The service-role key is required in the deployment environment and must never be exposed to the browser.

## 9. Acceptance tests (to run only after approval and application)

| ID | Scenario | Expected |
|---|---|---|
| PA-001 | Ordinary tenant user calls the switch action | Denied and audited |
| PA-002 | Platform admin without MFA switches | Denied and audited |
| PA-003 | Active platform admin switches | Session created, tenant context set, entry audited |
| PA-004 | Forged tenant id in request | Ignored; session tenant used |
| PA-005 | Read a table outside the session tenant | Zero rows |
| PA-006 | Attempt a write inside the tenant | Denied by design (no write path) |
| PA-007 | Exit | Session ended, cookie cleared, exit audited |
| PA-008 | Session after expiry | Treated as ended; no tenant data |
| PA-009 | Revoked admin with an active session | Blocked; session ended |
| PA-010 | Update or delete a platform audit row | Rejected |
| PA-011 | Tenant user queries platform tables | Permission denied |
| PA-012 | Service-role key in browser bundle | Never present |

## 10. Approval required before implementation

- [ ] Identity model confirmed (table vs claims vs allowlist).
- [ ] MFA AAL2 mandatory confirmed.
- [ ] Read-only v1 confirmed.
- [ ] 30-minute session length confirmed.
- [ ] Platform audit visibility confirmed.
- [ ] Service-role usage and deployment requirements accepted.
- [ ] Migration reviewed and applied to the non-production project.
- [ ] PA-001 to PA-012 executed and signed off.
