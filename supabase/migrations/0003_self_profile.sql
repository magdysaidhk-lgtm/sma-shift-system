-- ============================================================================
-- Extends 0001/0002 — run once in the SQL Editor.
-- Lets a supervisor edit their OWN name and national ID (their "ملفي الشخصي"
-- page). Everything else on their employee row (work_number, job_role, level,
-- status, group_name, etc.) stays admin-only, enforced by a trigger rather
-- than relying on RLS alone, since RLS can't restrict individual columns.
-- Login email changes go through Supabase Auth directly (auth.updateUser),
-- not through this table, so they aren't handled here.
-- ============================================================================

create policy employees_update_self on public.employees for update
  using (public.app_role() = 'supervisor' and id = public.current_employee_id())
  with check (public.app_role() = 'supervisor' and id = public.current_employee_id());

create or replace function public.fn_guard_employee_self_edit()
returns trigger language plpgsql as $$
begin
  if public.app_role() <> 'admin' then
    -- Silently keep every column except name/national_id at its previous
    -- value when a non-admin (i.e. the employee themselves) makes the edit.
    new.job_role := old.job_role;
    new.group_name := old.group_name;
    new.status := old.status;
    new.work_number := old.work_number;
    new.personal_phone := old.personal_phone;
    new.email := old.email;
    new.join_date := old.join_date;
    new.level := old.level;
    new.allowed_shift_codes := old.allowed_shift_codes;
    new.accepts_night_shift := old.accepts_night_shift;
    new.unavailable_days := old.unavailable_days;
    new.fixed_rest_day := old.fixed_rest_day;
    new.admin_notes := old.admin_notes;
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

create trigger trg_guard_employee_self_edit before update on public.employees
  for each row execute function public.fn_guard_employee_self_edit();
