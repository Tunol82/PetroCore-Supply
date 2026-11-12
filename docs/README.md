# PetroCore Supply — Project Documentation

Keep the approved product and engineering specifications version-controlled here.

Product naming is fixed: **PetroCore Supply** is the application. **Deuces** is a tenant using the application, not an alternative product name.

Recommended folders:
- `prd/` — Product Requirements Document
- `database/` — Database Dictionary and migration decisions
- `erd/` — logical and physical ERDs
- `business-rules/` — workflow and financial rules
- `architecture/` — technical blueprint and architecture decisions

Only approved, current versions should be treated as implementation authority. Do not silently resolve open business decisions in code.


## Database specifications
- [Database v1.2 Reconciliation Report](database/database-v1.2-reconciliation-report.md) — table-by-table mapping, changes, unresolved decisions, safeguards and migration gate.

- [Consolidated Database Dictionary v1.2 — Implementation Specification](database/consolidated-database-dictionary-v1.2.md) — controlled implementation review draft; source wording retained, with repository product/tenant naming clarified.

## Active implementation notes

- [Milestone 1 — Authentication, Tenant Management & Access Control](implementation/milestone-1-auth-tenant-access.md)

The milestone document defines the scope and release gate. It does not replace the approved source specifications or authorise business-schema migrations.
