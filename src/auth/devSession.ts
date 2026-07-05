import type { Role, UserProfile } from '../types/domain'
import { getDB } from '../services/mock/store'

// Only used while Supabase isn't connected yet (isSupabaseConfigured === false).
// Lets us exercise every role's UI/permissions locally via a role switcher in
// the header, without needing real accounts.
const DEV_ROLE_KEY = 'sma_v2_dev_role'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

export function getDevRole(): Role {
  return (localStorage.getItem(DEV_ROLE_KEY) as Role) || 'admin'
}

export function setDevRole(role: Role) {
  localStorage.setItem(DEV_ROLE_KEY, role)
}

export function getDevUserProfile(): UserProfile {
  const role = getDevRole()
  const firstEmployee = getDB().employees[0]
  return {
    id: DEV_USER_ID,
    role,
    displayName: 'مستخدم تجريبي (بدون Supabase)',
    employeeId: role === 'supervisor' ? firstEmployee?.id ?? null : null,
  }
}
