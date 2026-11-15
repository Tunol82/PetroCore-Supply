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

## AI agent handover

- [AI Agent Handover](AI_HANDOVER.md) — current repository state, approved architecture and business decisions, blockers, source documents and instructions for OpenCode/other coding agents. Read this first when resuming development.

## Database specifications
- [Consolidated Field-Level Database Dictionary v1.2](database/database-dictionary-v1.2-proposal.md) — complete v1.1 field-level baseline plus v1.2 amendments; owner-approved review baseline. DR-10, DR-20 and DR-24 remain open and no SQL is authorised.
- [ERD v1.2 Logical Model](erd/erd-v1.2-proposal.md) — reconstructed logical model; owner-approved with a re-verification condition if the original ERD artefact is produced.
- [Database v1.2 Reconciliation Report](database/database-v1.2-reconciliation-report.md) — table-by-table mapping, changes, decisions, safeguards and migration gate.
- [Consolidated Database Dictionary v1.2 — Implementation Specification](database/consolidated-database-dictionary-v1.2.md) — controlled implementation review draft; source wording retained, with repository product/tenant naming clarified.
- [Migration 1 — Tenant & Access Foundation: Reconciliation Checklist](database/migration-1-tenant-access-checklist.md) — entities, invariants, RLS questions and acceptance tests to close before any tenant/access SQL is written.
- [Migration 1 — Tenant & Access Physical Proposal](database/migration-1-physical-proposal.md) — proposed tables, ownership, RLS and candidate permission keys; draft SQL lives in `supabase/migrations-draft/` and is not applied.

## Business rules and decisions

- [Decision Register](business-rules/decision-register.md) — every business and schema decision with status, options, consequences and owner approval. DR-16 and DR-25 approved; DR-10, DR-20 and DR-24 open.

## Active implementation notes
- [Milestone 1 — Authentication, Tenant Management & Access Control](implementation/milestone-1-auth-tenant-access.md)
- [Non-Production Supabase Setup Plan](implementation/non-production-supabase-plan.md) — provisioning, verification and backup/restore steps; plan only, nothing executed.

The milestone document defines the scope and release gate. It does not replace the approved source specifications or authorise business-schema migrations.
