-- ============================================================================
-- OPTIONAL seed: imports the existing February 2026 roster/shifts that were
-- hardcoded in نظام_متابعة_الشيفتات.html (the FEB_2026 constant) so the new
-- system starts with real historical data instead of an empty database.
--
-- Run this manually, AFTER 0001_init.sql, only if you want this data.
-- Safe to skip entirely if you'd rather start empty.
-- ============================================================================

do $$
declare
  v_month_id uuid;
  v_employee jsonb;
  v_employee_id uuid;
  v_day text;
  v_code text;
  roster jsonb := '[
    {"name":"مرعي  محمود","role":"م . شيفت","phone":"201551376087","shifts":{"1":"F","2":"F","3":"F","4":"OFF","5":"F","6":"F","7":"F","8":"F","9":"F","10":"F","11":"OFF","19":"OFF","24":"F","25":"OFF","26":"F","27":"F","28":"F","29":"F","30":"F","31":"F"}},
    {"name":"فاطمة فخري","role":"م . شيفت","phone":"201031014140","shifts":{"1":"D","2":"D","3":"D","4":"D","5":"OFF","6":"D","7":"D","8":"D","9":"D","10":"D","11":"D","12":"OFF","13":"D","14":"D","15":"D","19":"OFF","24":"D","25":"D","26":"OFF","27":"D","28":"D","29":"D","30":"D","31":"D"}},
    {"name":"ريهام احمد","role":"اشراف","phone":"201036210109","shifts":{"1":"OFF","2":"OFF","3":"OFF","7":"N","8":"N","9":"OFF","10":"F","11":"F","12":"F","13":"F","14":"F","15":"F","17":"OFF","23":"OFF","24":"N","25":"N","26":"N","27":"N","28":"N","29":"N"}},
    {"name":"شيماء محمد","role":"اشراف","phone":"201015476091","shifts":{"1":"OFF","3":"OFF","8":"D","9":"OFF","10":"F","11":"F","12":"F","13":"F","14":"F","15":"F","16":"OFF","17":"OFF","23":"OFF","24":"N","25":"N","26":"N","27":"N","28":"N","29":"N"}},
    {"name":"هند","role":"اشراف","phone":"201040373880","shifts":{"1":"OFF","2":"OFF","7":"D","8":"D","9":"N","10":"N","11":"N","12":"N","13":"N","14":"N","15":"OFF","16":"OFF","22":"OFF","23":"D","24":"D","25":"D","26":"D","27":"D","28":"D","29":"D"}},
    {"name":"الاء محمد","role":"اشراف","phone":"201031212303","shifts":{"1":"OFF","2":"OFF","3":"OFF","6":"N","7":"OFF","8":"OFF","9":"D","10":"D","11":"D","12":"D","13":"D","14":"D","15":"OFF","16":"OFF","22":"OFF","23":"N","24":"N","25":"N","26":"N","27":"N","28":"N","29":"N"}},
    {"name":"عزيزة","role":"اشراف","phone":"201095689579","shifts":{"1":"OFF","2":"N7","3":"N7","4":"N7","5":"N7","6":"N7","7":"N7","8":"OFF","9":"OFF","10":"D","11":"D","12":"D","13":"D","14":"D","15":"OFF","16":"OFF","22":"OFF","23":"N7","24":"N7","25":"N7","26":"N7","27":"N7","28":"N7","29":"N7"}},
    {"name":"نور صلاح","role":"اشراف","phone":"201055843651","shifts":{"4":"OFF","7":"N","8":"N","9":"N","10":"OFF","11":"N7","12":"N7","13":"N7","14":"N7","15":"N7","16":"N7","17":"OFF","18":"OFF","23":"D","24":"OFF","25":"F","26":"F","27":"F","28":"F"}},
    {"name":"فاطمة احمد","role":"اشراف","phone":"","shifts":{"7":"N","8":"N","9":"OFF","10":"D","11":"D","12":"D","13":"D","14":"D","15":"D","16":"OFF","23":"N","24":"D","25":"OFF","26":"D","27":"D","28":"D","29":"D"}},
    {"name":"اروى احمد","role":"تدريب","phone":"","shifts":{"7":"D","8":"OFF","9":"N","10":"N","11":"N","12":"N","13":"N","14":"N","15":"OFF","23":"OFF","24":"F","25":"F","26":"F","27":"F","28":"F"}},
    {"name":"زينب حفني","role":"تدريب","phone":"201036621300","shifts":{"7":"F","8":"F","9":"OFF","10":"N","11":"N","12":"N","13":"N","14":"N","15":"OFF","22":"OFF","23":"N","24":"N","25":"N","26":"N","27":"N","28":"N","29":"N"}},
    {"name":"روا حمدي","role":"تدريب","phone":"","shifts":{"7":"F","8":"F","9":"OFF","10":"N","11":"N","12":"N","13":"N","14":"N","15":"N","16":"OFF","22":"OFF","23":"F","24":"F","25":"F","26":"F","27":"F","28":"F"}},
    {"name":"هدير","role":"تدريب","phone":"201004600721","shifts":{"7":"D","8":"D","9":"OFF","10":"F","11":"F","12":"F","13":"F","14":"F","15":"OFF"}},
    {"name":"شهد","role":"تدريب","phone":"","shifts":{"7":"N","8":"N","9":"N","10":"OFF","11":"D","12":"D","13":"D","14":"D","15":"D","16":"D","17":"OFF"}},
    {"name":"دعاء","role":"تدريب","phone":"","shifts":{"7":"D","8":"D","9":"D","10":"OFF","11":"N","12":"N","13":"N","14":"N","15":"N","16":"N","17":"OFF"}},
    {"name":"حبيبه عماد","role":"","phone":"","shifts":{"5":"OFF","6":"D","7":"D","8":"D","9":"D","10":"D","11":"OFF","12":"OFF","13":"OFF","14":"OFF"}}
  ]';
begin
  insert into public.months (year, month, status)
  values (2026, 2, 'draft')
  on conflict (year, month) do nothing
  returning id into v_month_id;

  if v_month_id is null then
    select id into v_month_id from public.months where year = 2026 and month = 2;
  end if;

  for v_employee in select * from jsonb_array_elements(roster)
  loop
    insert into public.employees (name, job_role, personal_phone)
    values (
      trim(v_employee ->> 'name'),
      nullif(v_employee ->> 'role', ''),
      nullif(v_employee ->> 'phone', '')
    )
    returning id into v_employee_id;

    for v_day, v_code in select * from jsonb_each_text(v_employee -> 'shifts')
    loop
      insert into public.shift_assignments (month_id, employee_id, day, shift_code)
      values (v_month_id, v_employee_id, v_day::int, v_code)
      on conflict (month_id, employee_id, day) do nothing;
    end loop;
  end loop;
end $$;
