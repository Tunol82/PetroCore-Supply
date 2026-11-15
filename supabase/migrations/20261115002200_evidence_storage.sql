-- =============================================================================
-- PetroCore Supply — Migration 22: Delivery evidence storage
-- =============================================================================
-- STATUS: Applied to the non-production project on 2026-11-16.
-- Migration history version: 20261115002200.
--
-- Delivery evidence moves from a typed storage reference to a private bucket.
--
-- Object paths are `organisation_id/trip_delivery_record_id/<uuid>.<ext>`, so
-- the first path segment is the tenant owner. Storage policies refuse any
-- object whose first segment is not the caller's organisation, which keeps the
-- bucket isolated in the same way as the row-level policies on public tables.
--
-- The bucket limits size and content type at the storage layer as well as in the
-- application, so a bypassed client cannot store arbitrary files.
--
-- Evidence is append-only: no update or delete policy is created.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-evidence',
  'delivery-evidence',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

alter table public.delivery_evidence
  add column if not exists file_size bigint,
  add column if not exists content_type varchar(120),
  add column if not exists original_filename varchar(255);

drop policy if exists delivery_evidence_objects_read on storage.objects;
create policy delivery_evidence_objects_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'delivery-evidence'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and (public.has_permission('transport.view') or public.has_permission('transport.manage'))
  );

drop policy if exists delivery_evidence_objects_insert on storage.objects;
create policy delivery_evidence_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-evidence'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
    and public.has_permission('transport.manage')
  );

commit;
