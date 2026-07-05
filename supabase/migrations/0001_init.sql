-- ============================================================================
-- Super Muslim Academy — Shift System
-- Initial schema: tables, RLS policies, audit log trigger, auth provisioning.
--
-- Run this once in the Supabase project's SQL editor (or via `supabase db push`
-- once the CLI is linked). After running it, the FIRST user who signs up will
-- get role='view_only' automatically — you must manually promote yourself to
-- admin once, from the SQL editor:
--   update public.users set role = 'admin' where id =
--     (select id from auth.users where email = 'you@example.com');
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. users  (profile + role, 1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'view_only'
                  check (role in ('admin','shift_manager','supervisor','view_only')),
  display_name  text not null,
  employee_id   uuid, -- FK added after employees table exists (below)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. employees
-- ----------------------------------------------------------------------------
create table public.employees (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  job_role           text,                         -- "م. شيفت" / "اشراف" / "تدريب" / ...
  status             text not null default 'active'
                       check (status in ('active','paused','on_leave')),
  national_id        text,                          -- الرقم الشخصي
  work_number        text,                          -- رقم الشغل
  personal_phone     text,
  email              text,
  join_date          date,
  level              int not null default 3 check (level between 1 and 5),
  allowed_shift_codes text[],                        -- null/empty = eligible for ALL shift types
  accepts_night_shift boolean not null default true,
  unavailable_days   int[] not null default '{}',   -- weekday indices (0=Sun..6=Sat) employee cannot work
  fixed_rest_day     int check (fixed_rest_day between 0 and 6),
  admin_notes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

alter table public.users
  add constraint users_employee_id_fkey foreign key (employee_id)
  references public.employees(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. shift_types
-- ----------------------------------------------------------------------------
create table public.shift_types (
  code               text primary key,
  description        text not null,
  color              text not null default '#8e44ad',
  text_color         text not null default '#ffffff',
  start_hour         int check (start_hour between 0 and 23),
  end_hour           int check (end_hour between 0 and 23),
  is_workable        boolean not null default true, -- counts as a real work shift (not OFF/Y/ABS)
  needs_confirmation boolean not null default false, -- e.g. N7: shown in UI, excluded from auto-generation
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

insert into public.shift_types (code, description, color, text_color, start_hour, end_hour, is_workable, needs_confirmation) values
  ('OFF', 'الاجازة الثابتة',                      '#CC4125', '#ffffff', null, null, false, false),
  ('N',   'شيفت 9 مساءً – 5 صباحًا',               '#3D85C6', '#ffffff', 21,   5,   true,  false),
  ('N3',  'شيفت 7 مساءً – 3 صباحًا',               '#17A2A2', '#ffffff', 19,   3,   true,  false),
  ('F',   'شيفت 5 صباحًا – 1 ظهرًا',               '#FFE599', '#3b3000', 5,    13,  true,  false),
  ('D',   'شيفت 1 ظهرًا – 9 مساءً',                '#38761D', '#ffffff', 13,   21,  true,  false),
  ('N7',  'شيفت ليلي ممتد (توقيته محتاج تأكيد)',   '#8E44AD', '#ffffff', null, null, true,  true),
  ('Y',   'الاجازة المرضية',                       '#E6B8AF', '#5a2e26', null, null, false, false),
  ('ABS', 'الغياب عن الشيفت دون إبلاغ مسبق',       '#495057', '#ffffff', null, null, false, false);

-- ----------------------------------------------------------------------------
-- 4. months
-- ----------------------------------------------------------------------------
create table public.months (
  id          uuid primary key default gen_random_uuid(),
  year        int not null,
  month       int not null check (month between 1 and 12),
  status      text not null default 'draft' check (status in ('draft','published','locked')),
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (year, month)
);

-- ----------------------------------------------------------------------------
-- 5. shift_assignments
-- ----------------------------------------------------------------------------
create table public.shift_assignments (
  id           uuid primary key default gen_random_uuid(),
  month_id     uuid not null references public.months(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  day          int not null check (day between 1 and 31),
  shift_code   text references public.shift_types(code),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (month_id, employee_id, day)
);
create index shift_assignments_month_idx on public.shift_assignments(month_id);
create index shift_assignments_employee_idx on public.shift_assignments(employee_id);

-- ----------------------------------------------------------------------------
-- 6. settings  (singleton row)
-- ----------------------------------------------------------------------------
create table public.settings (
  id               boolean primary key default true,
  allowed_rest_days int[] not null default '{1,2,3,4,5}', -- Sun=0..Sat=6, Fri/Sat excluded by default
  peak_start_h     int not null default 19,
  peak_end_h       int not null default 5,
  updated_at       timestamptz not null default now(),
  constraint settings_singleton check (id)
);
insert into public.settings (id) values (true);

-- ----------------------------------------------------------------------------
-- 7. change_requests
--    Not in the original minimum list, but required to actually implement the
--    Shift Manager "يقترح تعديل شيفت (لا يعتمد مباشرة)" and Supervisor
--    "يرسل طلب إجازة/تعديل (يحتاج موافقة)" behaviors described in the brief —
--    without it those two roles would have no write path at all.
-- ----------------------------------------------------------------------------
create table public.change_requests (
  id             uuid primary key default gen_random_uuid(),
  requested_by   uuid not null references public.users(id),
  month_id       uuid not null references public.months(id) on delete cascade,
  employee_id    uuid not null references public.employees(id) on delete cascade,
  day            int not null check (day between 1 and 31),
  requested_code text references public.shift_types(code),
  request_type   text not null check (request_type in ('shift_change','leave_request')),
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by    uuid references public.users(id),
  reviewed_at    timestamptz,
  note           text,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. audit_log  (append-only, populated only by trigger below)
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id),
  action_type  text not null, -- insert/update/delete (raw TG_OP, lowercased)
  table_name   text not null,
  record_id    uuid,
  employee_id  uuid,
  month_id     uuid,
  day          int,
  before       jsonb,
  after        jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_employee_idx on public.audit_log(employee_id);
create index audit_log_month_idx on public.audit_log(month_id);
create index audit_log_user_idx on public.audit_log(user_id);
create index audit_log_action_idx on public.audit_log(action_type);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Returns the caller's role without triggering RLS recursion on public.users.
create or replace function public.app_role()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

-- Returns the employee_id linked to the caller (for supervisor self-scoping).
create or replace function public.current_employee_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select employee_id from public.users where id = auth.uid();
$$;

-- Generic updated_at maintenance.
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at before update on public.users
  for each row execute function public.fn_set_updated_at();
create trigger trg_employees_updated_at before update on public.employees
  for each row execute function public.fn_set_updated_at();
create trigger trg_shift_types_updated_at before update on public.shift_types
  for each row execute function public.fn_set_updated_at();
create trigger trg_months_updated_at before update on public.months
  for each row execute function public.fn_set_updated_at();
create trigger trg_shift_assignments_updated_at before update on public.shift_assignments
  for each row execute function public.fn_set_updated_at();
create trigger trg_settings_updated_at before update on public.settings
  for each row execute function public.fn_set_updated_at();

-- Auto-create a public.users profile row whenever someone signs up via Supabase Auth.
-- Default role is the least-privileged one; promote the first admin manually (see top comment).
create or replace function public.fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email), 'view_only');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- Prevent non-admins from changing their own (or anyone's) role via a direct row update.
create or replace function public.fn_guard_users_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and public.app_role() <> 'admin' then
    raise exception 'only admin can change user roles';
  end if;
  return new;
end;
$$;

create trigger trg_guard_users_role before update on public.users
  for each row execute function public.fn_guard_users_role();

-- Generic audit log writer, attached to every business table below.
create or replace function public.fn_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_after  jsonb;
  v_record_id uuid;
  v_employee_id uuid;
  v_month_id uuid;
  v_day int;
begin
  if TG_OP = 'DELETE' then
    v_before := to_jsonb(OLD);
    v_after := null;
    v_record_id := OLD.id;
  elsif TG_OP = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(NEW);
    v_record_id := NEW.id;
  else
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    v_record_id := NEW.id;
  end if;

  v_employee_id := coalesce(
    (v_after ->> 'employee_id')::uuid,
    (v_before ->> 'employee_id')::uuid,
    case when TG_TABLE_NAME = 'employees' then v_record_id end
  );
  v_month_id := coalesce(
    (v_after ->> 'month_id')::uuid,
    (v_before ->> 'month_id')::uuid,
    case when TG_TABLE_NAME = 'months' then v_record_id end
  );
  v_day := coalesce((v_after ->> 'day')::int, (v_before ->> 'day')::int);

  insert into public.audit_log (user_id, action_type, table_name, record_id, employee_id, month_id, day, before, after)
  values (auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_record_id, v_employee_id, v_month_id, v_day, v_before, v_after);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

create trigger trg_audit_employees
  after insert or update or delete on public.employees
  for each row execute function public.fn_audit_log();
create trigger trg_audit_shift_assignments
  after insert or update or delete on public.shift_assignments
  for each row execute function public.fn_audit_log();
create trigger trg_audit_months
  after insert or update or delete on public.months
  for each row execute function public.fn_audit_log();
create trigger trg_audit_change_requests
  after insert or update or delete on public.change_requests
  for each row execute function public.fn_audit_log();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.users enable row level security;
alter table public.employees enable row level security;
alter table public.shift_types enable row level security;
alter table public.months enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.settings enable row level security;
alter table public.change_requests enable row level security;
alter table public.audit_log enable row level security;

-- ---- users ----
create policy users_select on public.users for select
  using (id = auth.uid() or public.app_role() = 'admin');
create policy users_insert_admin on public.users for insert
  with check (public.app_role() = 'admin');
create policy users_update on public.users for update
  using (id = auth.uid() or public.app_role() = 'admin')
  with check (id = auth.uid() or public.app_role() = 'admin');
create policy users_delete_admin on public.users for delete
  using (public.app_role() = 'admin');

-- ---- employees ----
create policy employees_select on public.employees for select
  using (
    case
      when public.app_role() = 'supervisor' then id = public.current_employee_id()
      else deleted_at is null or public.app_role() = 'admin'
    end
  );
create policy employees_insert_admin on public.employees for insert
  with check (public.app_role() = 'admin');
create policy employees_update_admin on public.employees for update
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');
create policy employees_delete_admin on public.employees for delete
  using (public.app_role() = 'admin');

-- ---- shift_types ---- (read: everyone signed in; write: admin only — Rules page)
create policy shift_types_select on public.shift_types for select
  using (auth.role() = 'authenticated');
create policy shift_types_write_admin on public.shift_types for all
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');

-- ---- months ----
create policy months_select on public.months for select
  using (auth.role() = 'authenticated');
create policy months_insert on public.months for insert
  with check (public.app_role() in ('admin','shift_manager'));
create policy months_update on public.months for update
  using (public.app_role() = 'admin' or (public.app_role() = 'shift_manager' and status <> 'locked'))
  with check (public.app_role() = 'admin' or (public.app_role() = 'shift_manager' and status <> 'locked'));
create policy months_delete_admin on public.months for delete
  using (public.app_role() = 'admin');

-- ---- shift_assignments ----
create policy shift_assignments_select on public.shift_assignments for select
  using (
    case
      when public.app_role() = 'supervisor' then employee_id = public.current_employee_id()
      else true
    end
  );
create policy shift_assignments_write on public.shift_assignments for all
  using (
    public.app_role() = 'admin'
    or (
      public.app_role() = 'shift_manager'
      and (
        shift_code in ('Y','ABS')
        or (select status from public.months m where m.id = month_id) = 'draft'
      )
    )
  )
  with check (
    public.app_role() = 'admin'
    or (
      public.app_role() = 'shift_manager'
      and (
        shift_code in ('Y','ABS')
        or (select status from public.months m where m.id = month_id) = 'draft'
      )
    )
  );

-- ---- settings ----
create policy settings_select on public.settings for select
  using (auth.role() = 'authenticated');
create policy settings_write_admin on public.settings for update
  using (public.app_role() = 'admin')
  with check (public.app_role() = 'admin');

-- ---- change_requests ----
create policy change_requests_select on public.change_requests for select
  using (
    case
      when public.app_role() = 'supervisor' then requested_by = auth.uid()
      else public.app_role() in ('admin','shift_manager','view_only')
    end
  );
create policy change_requests_insert on public.change_requests for insert
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and (
      (public.app_role() = 'shift_manager' and request_type = 'shift_change')
      or (public.app_role() = 'supervisor' and request_type = 'leave_request')
    )
  );
create policy change_requests_review on public.change_requests for update
  using (public.app_role() in ('admin','shift_manager') and requested_by <> auth.uid())
  with check (public.app_role() in ('admin','shift_manager') and requested_by <> auth.uid());
create policy change_requests_delete_admin on public.change_requests for delete
  using (public.app_role() = 'admin');

-- ---- audit_log ---- (append-only: no client insert/update/delete policy at all;
-- rows are written exclusively by the SECURITY DEFINER trigger function above)
create policy audit_log_select on public.audit_log for select
  using (public.app_role() in ('admin','shift_manager','view_only'));
