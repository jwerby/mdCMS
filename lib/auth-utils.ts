import { redirect } from '@tanstack/react-router'
import { checkAuthSession } from '../server/functions/auth-session'

/**
 * Use this in beforeLoad to protect routes
 * Uses a server function to avoid importing server-only code on client
 */
export async function requireAuth() {
  const result = await checkAuthSession()

  if (!result.authenticated) {
    throw redirect({ to: '/login' })
  }

  return result
}

/**
 * Use this for optional auth check (e.g., show/hide login button)
 */
export async function getAuthStatus() {
  try {
    return await checkAuthSession()
  } catch {
    return { authenticated: false, user: null, session: null }
  }
}
