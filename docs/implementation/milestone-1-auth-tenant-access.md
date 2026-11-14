# Milestone 1 — Authentication, Tenant Management & Access Control

**Product:** PetroCore Supply  
**Status:** Approved implementation milestone; physical database design remains gated  
**Target:** Establish a secure multi-tenant identity and access foundation before operational modules are built.

## 1. Outcome

A user can securely sign in, establish an authenticated session, belong to one or more tenant companies, select an authorised tenant, and access only the locations and actions permitted by their membership and role.

The product identity remains **PetroCore Supply**. Deuces is an example tenant/customer company, not the product name.

## 2. Architecture constraints

- Next.js App Router, React and TypeScript.
- Supabase Auth for identity and session management.
- Supabase PostgreSQL for tenant membership, roles, permissions, locations and audit records.
- Server-side session verification and trusted tenant resolution.
- PostgreSQL Row Level Security (RLS) is the final data-access boundary; hiding records in the UI is never sufficient.
- Tenant context must be derived from an authenticated membership and a server-validated selection. Never trust a tenant ID supplied only by the browser.
- The platform is a modular monolith. Do not introduce microservices for this milestone.
- PetroCore Supply remains a separate application from PetroCore Operations. Do not create cross-application foreign keys.
- No production credentials, service-role key or other secrets may be committed.

## 3. Scope

### Included
1. Supabase Auth integration and session lifecycle.
2. Sign-in and sign-out experience.
3. Authenticated application route protection.
4. Tenant membership resolution.
5. Tenant selection for users with more than one membership.
6. Tenant-scoped role and permission resolution.
7. Location access resolution and company-wide management visibility where explicitly authorised.
8. Audit events for security- and access-relevant actions.
9. Automated tests for authentication boundaries and cross-tenant isolation.

### Excluded
- Operational business transactions (procurement, sales, inventory, dispatch, delivery and finance).
- Production business-table migrations before the physical schema is reconciled.
- Phase 3 general-ledger accounting.
- Unapproved self-service invitations, public tenant registration or automatic role assignment.
- Treating offline/pending work as an authenticated or officially posted server transaction.

## 4. Canonical data-model alignment

The prior logical design identifies these canonical concepts and names to reconcile against the complete Database Dictionary v1.2 before migrations:

- `business_settings`: tenant/company identity and settings.
- `profiles`: application user profile linked to the authenticated identity.
- `business_locations`: tenant-owned operating locations.
- `user_roles`: role assignments within a tenant.
- `role_permissions`: permissions granted to roles.
- `user_location_access`: location-level access grants.
- `approval_records`: approval history where applicable.
- `audit_logs`: immutable audit events.

These names are a reconciliation checklist, **not authorisation to invent columns, keys, constraints or SQL**. Confirm exact field definitions, cardinality, deletion rules, indexes and RLS policies against the full Database Dictionary v1.2 and ERD v1.2 before creating migrations.

Supabase Auth's managed `auth.users` identity is distinct from the application profile and tenant membership records.

## 5. Tenant and access rules

1. A person may have memberships in multiple tenant companies.
2. A membership is the basis for tenant access; an authenticated user without an active membership has no tenant workspace access.
3. A tenant selection must be validated against the user's active memberships on the server.
4. Every tenant-owned query and mutation must be tenant-scoped and protected by RLS.
5. Location-scoped users may access only explicitly granted locations.
6. Company-wide visibility is a distinct permission, not an assumption attached to every role.
7. Roles and permissions are tenant-scoped unless the approved dictionary explicitly establishes a different model.
8. Never accept role, permission, tenant or location authority from client-submitted values.
9. Deactivated users, revoked memberships and disabled locations must lose access promptly.
10. Administrative access and role changes must be auditable.

## 6. Security implementation requirements

- Use Supabase SSR-compatible clients for browser and server contexts.
- Refresh sessions using the framework-supported request proxy mechanism.
- Verify identity and membership on the server for protected pages and server actions.
- Keep the Supabase service-role key server-only; do not use it as a shortcut around RLS in normal user flows.
- Apply least privilege and deny-by-default access.
- Enable RLS on every tenant-owned table.
- Add explicit tests proving that Tenant A cannot read, modify or infer Tenant B's records.
- Test unauthorised location access, revoked membership, inactive user and forged tenant-selection attempts.
- Record actor, tenant context, action, target, timestamp and relevant before/after metadata for auditable security changes, subject to the final dictionary.
- Do not log passwords, access tokens, secrets or unnecessary personal data.

## 7. UX acceptance criteria

- Sign-in screen clearly identifies PetroCore Supply.
- Validation and authentication errors are understandable and do not expose sensitive account details.
- Loading, success, empty-membership and expired-session states are handled.
- Users with one membership proceed to that workspace after server validation.
- Users with multiple memberships see only companies they are authorised to enter.
- Tenant identity is displayed inside the workspace without replacing the PetroCore Supply product identity.
- Users with no active membership receive a clear access-pending state rather than an empty or misleading dashboard.
- Location restrictions are visible and understandable.
- Core flows are keyboard accessible and responsive on desktop and mobile.

## 8. Delivery sequence

1. Reconcile the complete approved source documents and confirm exact profile, tenant, membership, role, permission, location and audit fields.
2. Configure a non-production Supabase project and environment variables without committing secrets.
3. Create the reviewed database migration and RLS policies only after schema sign-off.
4. Implement Supabase SSR clients and session refresh.
5. Implement sign-in/sign-out and protected routes.
6. Implement server-validated tenant membership and tenant selection.
7. Implement role/permission and location-access checks.
8. Add audit recording for access administration.
9. Add unit, integration and end-to-end security tests.
10. Run lint, typecheck, unit tests, end-to-end tests and production build before declaring the milestone complete.

## 9. Release gate

Milestone 1 is complete only when:
- the physical schema matches the reconciled dictionary and ERD;
- RLS and server-side authorisation pass cross-tenant and cross-location tests;
- sign-in, session refresh, sign-out and tenant selection work end to end;
- no secrets are committed;
- automated checks pass; and
- an authorised tenant administrator can manage approved memberships and access without bypassing audit controls.

**Important:** This document governs milestone scope. It does not replace the Database Dictionary, ERD, Business Rules & Financial Logic Specification or Technical Blueprint, and it does not authorise production database changes by itself.
