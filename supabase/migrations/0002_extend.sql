-- ============================================================================
-- Extends 0001_init.sql — run this once in the SQL Editor, same as before.
-- Adds: employees.group_name (WhatsApp/group label, existed in the original
-- file as `group` but was dropped during the initial schema design), and a
-- job_roles table so job titles are admin-editable like shift_types instead
-- of a hardcoded list in the frontend.
-- ============================================================================

alter table public.employees add column if not exists group_name text;

create table if not exists public.job_roles (
  name       text primary key,
  created_at timestamptz not null default now()
);

insert into public.job_roles (name) values
  ('م . شيفت'), ('اشراف'), ('تدريب')
on conflict (name) do nothing;

alter table public.job_roles enable row level security;

create policy job_roles_select on public.job_roles for select
  using (auth.role() = 'authenticated');
create policy job_roles_write_admin on public.job_roles for all
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');
