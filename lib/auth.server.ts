import { betterAuth } from 'better-auth'
import Database from 'better-sqlite3'
import path from 'path'

// Use SQLite database in the content folder (file-based, fits the CMS philosophy)
const db = new Database(path.join(process.cwd(), 'content', 'auth.db'))

// Detect production environment
const isProduction = process.env.NODE_ENV === 'production'

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3113',
  trustedOrigins: [
    'http://localhost:3113',
    'http://localhost:3000',
    'http://127.0.0.1:3113',
    // Add production URL if set
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  emailAndPassword: {
    enabled: true,
    // Require email verification: false for simple CMS use
    requireEmailVerification: false,
    // Password validation (minimum 8 characters, recommended 12+)
    password: {
      minLength: 8,
      maxLength: 128,
    },
  },
  session: {
    // Session expires after 24 hours (reduced from 7 days for security)
    expiresIn: 60 * 60 * 24, // 24 hours
    // Update session expiry when accessed within 1 hour of expiry
    updateAge: 60 * 60, // 1 hour
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    // Force secure cookies in production
    useSecureCookies: isProduction,
    // Custom cookie attributes for enhanced security
    cookies: {
      session_token: {
        name: 'session_token',
        attributes: {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax', // Lax allows navigation, prevents CSRF
          path: '/',
        },
      },
      session_data: {
        name: 'session_data',
        attributes: {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
        },
      },
    },
    // Cookie prefix for namespace isolation
    cookiePrefix: 'mdcms',
  },
})

export type Session = typeof auth.$Infer.Session
