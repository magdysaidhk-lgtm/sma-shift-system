import type { Employee, ShiftType, Settings } from '../../types/domain'

// Mirrors supabase/migrations/0001_init.sql shift_types seed exactly.
export const SEED_SHIFT_TYPES: ShiftType[] = [
  { code: 'OFF', description: 'الاجازة الثابتة', color: '#CC4125', textColor: '#ffffff', startHour: null, endHour: null, isWorkable: false, needsConfirmation: false },
  { code: 'N', description: 'شيفت 9 مساءً – 5 صباحًا', color: '#3D85C6', textColor: '#ffffff', startHour: 21, endHour: 5, isWorkable: true, needsConfirmation: false },
  { code: 'N3', description: 'شيفت 7 مساءً – 3 صباحًا', color: '#17A2A2', textColor: '#ffffff', startHour: 19, endHour: 3, isWorkable: true, needsConfirmation: false },
  { code: 'F', description: 'شيفت 5 صباحًا – 1 ظهرًا', color: '#FFE599', textColor: '#3b3000', startHour: 5, endHour: 13, isWorkable: true, needsConfirmation: false },
  { code: 'D', description: 'شيفت 1 ظهرًا – 9 مساءً', color: '#38761D', textColor: '#ffffff', startHour: 13, endHour: 21, isWorkable: true, needsConfirmation: false },
  { code: 'N7', description: 'شيفت ليلي ممتد (توقيته محتاج تأكيد)', color: '#8E44AD', textColor: '#ffffff', startHour: null, endHour: null, isWorkable: true, needsConfirmation: true },
  { code: 'Y', description: 'الاجازة المرضية', color: '#E6B8AF', textColor: '#5a2e26', startHour: null, endHour: null, isWorkable: false, needsConfirmation: false },
  { code: 'ABS', description: 'الغياب عن الشيفت دون إبلاغ مسبق', color: '#495057', textColor: '#ffffff', startHour: null, endHour: null, isWorkable: false, needsConfirmation: false },
]

export const SEED_SETTINGS: Settings = {
  allowedRestDays: [1, 2, 3, 4, 5],
  peakStartH: 19,
  peakEndH: 5,
}

interface SeedEmployee {
  name: string
  role: string
  phone: string
  shifts: Record<string, string>
}

// Same roster/shifts as FEB_2026 in the original نظام_متابعة_الشيفتات.html (line 597),
// reused here so the app has real data to browse before Supabase is connected.
export const SEED_FEB_2026: SeedEmployee[] = [
  { name: 'مرعي  محمود', role: 'م . شيفت', phone: '201551376087', shifts: { '1': 'F', '2': 'F', '3': 'F', '4': 'OFF', '5': 'F', '6': 'F', '7': 'F', '8': 'F', '9': 'F', '10': 'F', '11': 'OFF', '19': 'OFF', '24': 'F', '25': 'OFF', '26': 'F', '27': 'F', '28': 'F', '29': 'F', '30': 'F', '31': 'F' } },
  { name: 'فاطمة فخري', role: 'م . شيفت', phone: '201031014140', shifts: { '1': 'D', '2': 'D', '3': 'D', '4': 'D', '5': 'OFF', '6': 'D', '7': 'D', '8': 'D', '9': 'D', '10': 'D', '11': 'D', '12': 'OFF', '13': 'D', '14': 'D', '15': 'D', '19': 'OFF', '24': 'D', '25': 'D', '26': 'OFF', '27': 'D', '28': 'D', '29': 'D', '30': 'D', '31': 'D' } },
  { name: 'ريهام احمد', role: 'اشراف', phone: '201036210109', shifts: { '1': 'OFF', '2': 'OFF', '3': 'OFF', '7': 'N', '8': 'N', '9': 'OFF', '10': 'F', '11': 'F', '12': 'F', '13': 'F', '14': 'F', '15': 'F', '17': 'OFF', '23': 'OFF', '24': 'N', '25': 'N', '26': 'N', '27': 'N', '28': 'N', '29': 'N' } },
  { name: 'شيماء محمد', role: 'اشراف', phone: '201015476091', shifts: { '1': 'OFF', '3': 'OFF', '8': 'D', '9': 'OFF', '10': 'F', '11': 'F', '12': 'F', '13': 'F', '14': 'F', '15': 'F', '16': 'OFF', '17': 'OFF', '23': 'OFF', '24': 'N', '25': 'N', '26': 'N', '27': 'N', '28': 'N', '29': 'N' } },
  { name: 'هند', role: 'اشراف', phone: '201040373880', shifts: { '1': 'OFF', '2': 'OFF', '7': 'D', '8': 'D', '9': 'N', '10': 'N', '11': 'N', '12': 'N', '13': 'N', '14': 'N', '15': 'OFF', '16': 'OFF', '22': 'OFF', '23': 'D', '24': 'D', '25': 'D', '26': 'D', '27': 'D', '28': 'D', '29': 'D' } },
  { name: 'الاء محمد', role: 'اشراف', phone: '201031212303', shifts: { '1': 'OFF', '2': 'OFF', '3': 'OFF', '6': 'N', '7': 'OFF', '8': 'OFF', '9': 'D', '10': 'D', '11': 'D', '12': 'D', '13': 'D', '14': 'D', '15': 'OFF', '16': 'OFF', '22': 'OFF', '23': 'N', '24': 'N', '25': 'N', '26': 'N', '27': 'N', '28': 'N', '29': 'N' } },
  { name: 'عزيزة', role: 'اشراف', phone: '201095689579', shifts: { '1': 'OFF', '2': 'N7', '3': 'N7', '4': 'N7', '5': 'N7', '6': 'N7', '7': 'N7', '8': 'OFF', '9': 'OFF', '10': 'D', '11': 'D', '12': 'D', '13': 'D', '14': 'D', '15': 'OFF', '16': 'OFF', '22': 'OFF', '23': 'N7', '24': 'N7', '25': 'N7', '26': 'N7', '27': 'N7', '28': 'N7', '29': 'N7' } },
  { name: 'نور صلاح', role: 'اشراف', phone: '201055843651', shifts: { '4': 'OFF', '7': 'N', '8': 'N', '9': 'N', '10': 'OFF', '11': 'N7', '12': 'N7', '13': 'N7', '14': 'N7', '15': 'N7', '16': 'N7', '17': 'OFF', '18': 'OFF', '23': 'D', '24': 'OFF', '25': 'F', '26': 'F', '27': 'F', '28': 'F' } },
  { name: 'فاطمة احمد', role: 'اشراف', phone: '', shifts: { '7': 'N', '8': 'N', '9': 'OFF', '10': 'D', '11': 'D', '12': 'D', '13': 'D', '14': 'D', '15': 'D', '16': 'OFF', '23': 'N', '24': 'D', '25': 'OFF', '26': 'D', '27': 'D', '28': 'D', '29': 'D' } },
  { name: 'اروى احمد', role: 'تدريب', phone: '', shifts: { '7': 'D', '8': 'OFF', '9': 'N', '10': 'N', '11': 'N', '12': 'N', '13': 'N', '14': 'N', '15': 'OFF', '23': 'OFF', '24': 'F', '25': 'F', '26': 'F', '27': 'F', '28': 'F' } },
  { name: 'زينب حفني', role: 'تدريب', phone: '201036621300', shifts: { '7': 'F', '8': 'F', '9': 'OFF', '10': 'N', '11': 'N', '12': 'N', '13': 'N', '14': 'N', '15': 'OFF', '22': 'OFF', '23': 'N', '24': 'N', '25': 'N', '26': 'N', '27': 'N', '28': 'N', '29': 'N' } },
  { name: 'روا حمدي', role: 'تدريب', phone: '', shifts: { '7': 'F', '8': 'F', '9': 'OFF', '10': 'N', '11': 'N', '12': 'N', '13': 'N', '14': 'N', '15': 'N', '16': 'OFF', '22': 'OFF', '23': 'F', '24': 'F', '25': 'F', '26': 'F', '27': 'F', '28': 'F' } },
  { name: 'هدير', role: 'تدريب', phone: '201004600721', shifts: { '7': 'D', '8': 'D', '9': 'OFF', '10': 'F', '11': 'F', '12': 'F', '13': 'F', '14': 'F', '15': 'OFF' } },
  { name: 'شهد', role: 'تدريب', phone: '', shifts: { '7': 'N', '8': 'N', '9': 'N', '10': 'OFF', '11': 'D', '12': 'D', '13': 'D', '14': 'D', '15': 'D', '16': 'D', '17': 'OFF' } },
  { name: 'دعاء', role: 'تدريب', phone: '', shifts: { '7': 'D', '8': 'D', '9': 'D', '10': 'OFF', '11': 'N', '12': 'N', '13': 'N', '14': 'N', '15': 'N', '16': 'N', '17': 'OFF' } },
  { name: 'حبيبه عماد', role: '', phone: '', shifts: { '5': 'OFF', '6': 'D', '7': 'D', '8': 'D', '9': 'D', '10': 'D', '11': 'OFF', '12': 'OFF', '13': 'OFF', '14': 'OFF' } },
]

export function seedEmployees(): Employee[] {
  return SEED_FEB_2026.map((e) => ({
    id: crypto.randomUUID(),
    name: e.name.trim(),
    jobRole: e.role || null,
    status: 'active',
    nationalId: null,
    workNumber: null,
    personalPhone: e.phone || null,
    email: null,
    joinDate: null,
    level: 3,
    allowedShiftCodes: null,
    acceptsNightShift: true,
    unavailableDays: [],
    fixedRestDay: null,
    adminNotes: null,
    deletedAt: null,
  }))
}
