# قاعدة البيانات (Supabase)

## طريقة التشغيل (وقت توفر حساب Supabase)
1. أنشئ مشروع جديد على supabase.com.
2. من SQL Editor بالمشروع، شغّل محتوى `migrations/0001_init.sql` كامل مرة واحدة.
3. (اختياري) شغّل `seed.sql` لاستيراد بيانات فبراير 2026 الموجودة حاليًا في الملف الأصلي.
4. سجّل حسابك الأول من صفحة تسجيل الدخول في التطبيق (Supabase Auth) — هيتسجل تلقائيًا بدور `view_only`.
5. من SQL Editor، رقّي حسابك لـ admin:
   ```sql
   update public.users set role = 'admin'
   where id = (select id from auth.users where email = 'بريدك@example.com');
   ```
6. من هنا فصاعدًا، الـ Admin يقدر يرقّي بقية المستخدمين من الواجهة (أو نفس طريقة SQL).

## الجداول
- `users` — بروفايل + دور، مرتبط 1:1 بـ `auth.users`.
- `employees` — بيانات الموظفين (soft delete عبر `deleted_at`).
- `shift_types` — تعريف الشيفتات (معبأة مسبقًا بالثمانية الأصليين).
- `months` — حالة كل شهر (draft/published/locked).
- `shift_assignments` — الخانة الفعلية (شهر × موظف × يوم).
- `settings` — صف واحد فقط: أيام الراحة المسموحة + نافذة وقت الضغط.
- `change_requests` — طلبات تعديل شيفت (Shift Manager) وطلبات إجازة (Supervisor) قبل الاعتماد. **جدول مُضاف غير مذكور في القائمة الأصلية** — بدونه لم يكن لدور Shift Manager/Supervisor أي مسار كتابة فعلي كما وصفه البرومبت.
- `audit_log` — سجل كل عملية كتابة، يُملأ فقط عبر trigger (لا يمكن الكتابة فيه مباشرة من العميل حتى لو Admin).

## RLS — ملخص الصلاحيات الفعلية
| الجدول | Admin | Shift Manager | Supervisor | View Only |
|---|---|---|---|---|
| employees | كل شيء | قراءة فقط | قراءة بياناته هو فقط | قراءة فقط |
| shift_assignments | كل شيء | كتابة إجازة/غياب دائمًا؛ باقي التعديلات فقط لو الشهر Draft | قراءة شيفتاته هو فقط | قراءة فقط |
| months | كل شيء | إنشاء/تعديل طالما مش Locked | قراءة فقط | قراءة فقط |
| shift_types / settings | كل شيء | قراءة فقط | قراءة فقط | قراءة فقط |
| change_requests | كل شيء (مراجعة/اعتماد) | إنشاء طلب تعديل شيفت + مراجعة طلبات الآخرين | إنشاء طلب إجازة لنفسه فقط | — |
| audit_log | قراءة فقط (لا كتابة لحد) | قراءة فقط | لا يرى | قراءة فقط |

كل هذا مفروض فعليًا من جهة قاعدة البيانات (Row Level Security)، مش مجرد إخفاء أزرار في الواجهة.

## النسخ الاحتياطي
- **يدوي**: من صفحة "القواعد" (Admin فقط) — زر تصدير (تنزيل JSON) وزر استيراد (يستبدل البيانات الحالية بعد تأكيد).
- **تلقائي يومي**: `functions/daily-backup/index.ts` — Edge Function تجمع كل الجداول وترفعها كملف JSON في Storage bucket اسمه `backups`. خطوات التفعيل وقت توفر الحساب:
  1. أنشئ Storage bucket اسمه `backups` (Private) من لوحة Supabase.
  2. `supabase functions deploy daily-backup`
  3. من لوحة Edge Functions، فعّل Schedule بـ cron مثل `0 2 * * *` (٢ص يوميًا).
  - المتغيرات `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` متاحة تلقائيًا داخل بيئة الـ Edge Function — لا تحتاج ضبط يدوي.
