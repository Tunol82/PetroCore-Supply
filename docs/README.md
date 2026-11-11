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


## Active implementation notes

- [Milestone 1 — Authentication, Tenant Management & Access Control](implementation/milestone-1-auth-tenant-access.md)

The milestone document defines the scope and release gate. It does not replace the approved source specifications or authorise business-schema migrations.
