import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../../lib/auth.server'

/**
 * Server function to check the current session
 * This is safe to call from beforeLoad because it uses createServerFn
 */
export const checkAuthSession = createServerFn({ method: 'GET' })
  .handler(async () => {
    const request = getRequest()

    if (!request) {
      return { authenticated: false, user: null, session: null }
    }

    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        return { authenticated: false, user: null, session: null }
      }

      return {
        authenticated: true,
        user: session.user,
        session: session.session,
      }
    } catch {
      return { authenticated: false, user: null, session: null }
    }
  })
