-- Migration: 20260910160049_portfolio_documents.sql
-- Description: Student Digital Portfolio Document Upload & Evidence Storage
-- Module: Digital Portfolio Document Attachments

-- =============================================================================
-- 1. STORAGE BUCKET: portfolio-documents
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-documents',
  'portfolio-documents',
  false,
  5242880, -- 5 MB (5 * 1024 * 1024)
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- =============================================================================
-- 2. STORAGE RLS POLICIES (bucket: portfolio-documents)
-- Path format: <student_id>/<portfolio_item_id>/<unique-file-name>
-- =============================================================================

-- 2.1 SELECT: Student can only view and download their own files
drop policy if exists "portfolio_documents_storage_select" on storage.objects;
create policy "portfolio_documents_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'portfolio-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2.2 INSERT: Student can only upload inside their own folder
drop policy if exists "portfolio_documents_storage_insert" on storage.objects;
create policy "portfolio_documents_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2.3 UPDATE: Student can only update their own files
drop policy if exists "portfolio_documents_storage_update" on storage.objects;
create policy "portfolio_documents_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'portfolio-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'portfolio-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2.4 DELETE: Student can only delete their own files
drop policy if exists "portfolio_documents_storage_delete" on storage.objects;
create policy "portfolio_documents_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'portfolio-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- 3. TABLE DEFINITION: public.portfolio_documents
-- =============================================================================

create table if not exists public.portfolio_documents (
  id uuid primary key default gen_random_uuid(),
  portfolio_item_id uuid not null references public.portfolio_items(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_type text not null check (file_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_portfolio_documents_portfolio_item_id on public.portfolio_documents(portfolio_item_id);
create index if not exists idx_portfolio_documents_student_id on public.portfolio_documents(student_id);

-- =============================================================================
-- 4. INTEGRITY TRIGGER: Verify cross-table student_id consistency & immutability
-- =============================================================================

create or replace function public.validate_portfolio_document_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_student_id uuid;
begin
  -- Verify the referenced portfolio_item exists and belongs to the same student
  select student_id into v_item_student_id
  from public.portfolio_items
  where id = new.portfolio_item_id;

  if v_item_student_id is null then
    raise exception 'Target portfolio item does not exist.';
  end if;

  if v_item_student_id != new.student_id then
    raise exception 'Document student_id does not match portfolio item student_id.';
  end if;

  -- Protect immutable fields on update
  if tg_op = 'UPDATE' then
    if old.id is distinct from new.id then
      raise exception 'Document ID is immutable.';
    end if;
    if old.student_id is distinct from new.student_id then
      raise exception 'student_id is immutable.';
    end if;
    if old.portfolio_item_id is distinct from new.portfolio_item_id then
      raise exception 'portfolio_item_id is immutable.';
    end if;
    if old.created_at is distinct from new.created_at then
      raise exception 'created_at is immutable.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_portfolio_documents_ownership on public.portfolio_documents;
create trigger trg_portfolio_documents_ownership
  before insert or update on public.portfolio_documents
  for each row
  execute function public.validate_portfolio_document_ownership();

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES ON public.portfolio_documents
-- =============================================================================

alter table public.portfolio_documents enable row level security;

-- 5.1 SELECT: Student can only select their own document metadata
drop policy if exists "portfolio_documents_select" on public.portfolio_documents;
create policy "portfolio_documents_select"
  on public.portfolio_documents
  for select
  to authenticated
  using (
    student_id = auth.uid()
  );

-- 5.2 INSERT: Student can only insert document metadata for themselves
drop policy if exists "portfolio_documents_insert" on public.portfolio_documents;
create policy "portfolio_documents_insert"
  on public.portfolio_documents
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
  );

-- 5.3 UPDATE: Student can only update their own document metadata
drop policy if exists "portfolio_documents_update" on public.portfolio_documents;
create policy "portfolio_documents_update"
  on public.portfolio_documents
  for update
  to authenticated
  using (
    student_id = auth.uid()
  )
  with check (
    student_id = auth.uid()
  );

-- 5.4 DELETE: Student can only delete their own document metadata
drop policy if exists "portfolio_documents_delete" on public.portfolio_documents;
create policy "portfolio_documents_delete"
  on public.portfolio_documents
  for delete
  to authenticated
  using (
    student_id = auth.uid()
  );
