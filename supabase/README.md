# Supabase setup

Supabase is the planned PostgreSQL, Auth and Storage platform.

**Do not connect a production project or create business tables from this scaffold alone.** First reconcile the approved Database Dictionary v1.2, ERD v1.2, Business Rules & Financial Logic Specification and Technical Blueprint into exact migration definitions.

## Security requirements

- Enable RLS on every tenant-owned table.
- Derive tenant and user identity from trusted server/auth context; never trust a tenant ID supplied only by the browser.
- Keep service-role credentials server-only.
- Test cross-tenant reads and writes explicitly.
- Use database transactions and constraints for authoritative financial, inventory and fulfilment operations.

Migration files belong in `migrations/`; database tests belong in `tests/`.
