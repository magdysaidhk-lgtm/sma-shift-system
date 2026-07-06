// Supabase Auth is email-based under the hood, but not every employee has a
// real email the admin knows. For those, we accept a plain username and
// silently map it to a synthetic address on a fixed internal domain, so
// Supabase's auth.users table still gets something shaped like an email.
// The employee only ever sees/types the username — this suffix is invisible
// to them.
export const USERNAME_DOMAIN = '@account.sma-internal.local'

export function isPlainUsername(value: string): boolean {
  return !value.includes('@')
}

export function toAuthEmail(usernameOrEmail: string): string {
  const trimmed = usernameOrEmail.trim()
  return isPlainUsername(trimmed) ? `${trimmed}${USERNAME_DOMAIN}` : trimmed
}

/** Reverses toAuthEmail for display — shows the bare username instead of the internal synthetic domain. */
export function fromAuthEmail(authEmail: string): string {
  return authEmail.endsWith(USERNAME_DOMAIN) ? authEmail.slice(0, -USERNAME_DOMAIN.length) : authEmail
}
