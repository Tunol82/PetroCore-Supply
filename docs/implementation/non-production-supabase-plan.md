# Non-Production Supabase Setup Plan

**Status:** Plan only. Nothing in this document has been executed, and no project credentials exist in the repository.  
**Applies to:** Milestone 1 verification (authentication, session lifecycle, tenant membership, RLS).  
**Prepared:** 2026-11-15.

## 1. Rules

1. Use a **separate Supabase project** from PetroCore Operations. Never point this application at the StationOs/PetroCore production database.
2. Never commit the service-role key, database password or any real credential. `.env.local` is git-ignored; `.env.example` contains names only.
3. The service-role key is server-only and must not be used to bypass RLS in ordinary user flows.
4. Do not create business tables or RLS policies until the database gate is cleared and the tenant/access checklist is signed off.
5. The target is **greenfield** (DR-25, approved 2026-11-15). Confirm the project is empty before the first migration and revisit this plan if any pre-existing schema or data is discovered.

## 2. Prerequisites

- [ ] Product owner approves creating a non-production project.
- [ ] Confirm the project is **empty** — no pre-existing schema, data or extensions beyond Supabase defaults (DR-25 greenfield).
- [ ] Confirm the project is not shared with another application.
- [ ] Confirm the region and plan; record both in the project handover.
- [ ] Confirm who holds owner access and where recovery codes are stored (outside the repository).

## 3. Provisioning steps

1. Create the Supabase project with a name that identifies it as non-production, for example `petrocore-supply-dev`.
2. Record the project reference and region in the handover document, not in source control.
3. Enable email/password authentication. Disable public sign-up while there is no approved onboarding flow.
4. Add the project URL and anon key to local `.env.local` only:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

5. Restart the development server and confirm the workspace no longer renders the setup notice.
6. Create two test tenant organisations and at least two test identities through the approved administrative path once the schema exists. Do not use real customer data.

## 4. Verification before any schema work

- [ ] Sign-in succeeds with a valid test identity and fails generically with an invalid one.
- [ ] An authenticated visit to `/login` redirects to `/workspace`.
- [ ] An anonymous visit to `/workspace` redirects to `/login`.
- [ ] Sign-out clears the session and returns to `/login`.
- [ ] Session refresh does not drop an active session on navigation.
- [ ] No secret appears in the client bundle or the repository.

## 5. Verification after the schema is approved

- [ ] Tenant A cannot read, write or infer Tenant B records (T-001).
- [ ] A forged organisation identifier cannot change the resolved tenant (T-002).
- [ ] Location grants cannot cross tenants (T-004).
- [ ] Revoked membership loses access immediately (T-008).
- [ ] Audit records are append-only (T-012).
- [ ] Backup and restore are tested in a second environment.

## 6. Backup and restore drill

1. Take a baseline backup immediately after provisioning and before any migration.
2. Restore it into a separate scratch project.
3. Confirm the restore completes and the expected objects are present.
4. Record the restore duration and any manual steps.
5. Repeat after the first approved migration, before sign-off.

## 7. Cleanup and rollback

- Keep the project isolated; deleting it must never affect PetroCore Operations.
- If a migration fails validation, restore from the baseline backup rather than attempting a partial rollback.
- Document any abandoned project so credentials are revoked.

## 8. Outstanding decisions blocking execution

| Decision | Status |
|---|---|
| Greenfield or legacy migration (DR-25) | **Approved — greenfield, 2026-11-15** |
| Field-level Database Dictionary v1.2 | Available and owner-approved as review baseline |
| ERD v1.2 | Reconstructed proposal, owner-approved with re-verification condition |
| Canonical table naming (DR-16) | **Approved — retain v1.1 names, 2026-11-15** |
| Approval model (DR-20) | **Approved — deferred to the finance milestone, 2026-11-15** |
| Tenant/location ownership coverage (DR-24) | **Approved — direct ownership, 2026-11-15** |
| Location model and hierarchy (DR-10) | **Approved — flat, typed, 2026-11-15** |

Until these are closed, only the verification steps in Section 4 may be performed, and only against a project that contains no business tables.
