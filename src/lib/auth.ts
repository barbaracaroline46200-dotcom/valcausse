import { cookies } from 'next/headers'

const COOKIE_NAME = 'valcausse_admin'
const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8h

export function isAdminFromCookie(): boolean {
  const cookieStore = cookies()
  const c = cookieStore.get(COOKIE_NAME)
  if (!c) return false
  try {
    const { expires } = JSON.parse(c.value)
    return Date.now() < expires
  } catch {
    return false
  }
}

export function makeAdminCookieValue(): string {
  return JSON.stringify({ expires: Date.now() + SESSION_DURATION })
}

export function checkAdminPassword(password: string): boolean {
  return password === process.env.ADMIN_PASSWORD
}
