/**
 * Audit Logging for Security Events
 *
 * Provides structured logging for authentication, authorization,
 * and security-related events. Stores logs in SQLite for querying
 * and analysis.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

/**
 * Audit event types
 */
export type AuditEventType =
  // Authentication events
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_logout'
  | 'auth_session_expired'
  | 'auth_session_created'
  // Authorization events
  | 'auth_access_denied'
  | 'auth_rate_limited'
  // Security violations
  | 'security_path_traversal'
  | 'security_xss_blocked'
  | 'security_invalid_input'
  | 'security_csrf_blocked'
  // Content events
  | 'content_created'
  | 'content_updated'
  | 'content_deleted'
  | 'content_published'
  | 'content_unpublished'
  // File events
  | 'file_uploaded'
  | 'file_deleted'
  // AI events
  | 'ai_generation_started'
  | 'ai_generation_completed'
  | 'ai_generation_failed'

/**
 * Severity levels for audit events
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  id?: number
  timestamp: string
  eventType: AuditEventType
  severity: AuditSeverity
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  resource?: string
  action?: string
  details?: string
  success: boolean
}

/**
 * Database singleton for audit logs
 */
let db: Database.Database | null = null

/**
 * Get or create the audit log database
 */
function getDatabase(): Database.Database {
  if (db) return db

  const dbDir = path.join(process.cwd(), 'content')
  const dbPath = path.join(dbDir, 'audit.db')

  // Ensure content directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      user_id TEXT,
      user_email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      resource TEXT,
      action TEXT,
      details TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity);
  `)

  return db
}

/**
 * Determine severity based on event type
 */
function getSeverity(eventType: AuditEventType): AuditSeverity {
  const severityMap: Record<AuditEventType, AuditSeverity> = {
    // Auth - info/warning
    auth_login_success: 'info',
    auth_login_failure: 'warning',
    auth_logout: 'info',
    auth_session_expired: 'info',
    auth_session_created: 'info',
    auth_access_denied: 'warning',
    auth_rate_limited: 'warning',
    // Security - warning/error/critical
    security_path_traversal: 'critical',
    security_xss_blocked: 'error',
    security_invalid_input: 'warning',
    security_csrf_blocked: 'error',
    // Content - info
    content_created: 'info',
    content_updated: 'info',
    content_deleted: 'warning',
    content_published: 'info',
    content_unpublished: 'info',
    // File - info/warning
    file_uploaded: 'info',
    file_deleted: 'warning',
    // AI - info
    ai_generation_started: 'info',
    ai_generation_completed: 'info',
    ai_generation_failed: 'warning',
  }

  return severityMap[eventType] || 'info'
}

/**
 * Log an audit event
 */
export function auditLog(
  eventType: AuditEventType,
  options: {
    userId?: string
    userEmail?: string
    ipAddress?: string
    userAgent?: string
    resource?: string
    action?: string
    details?: Record<string, unknown> | string
    success?: boolean
  } = {}
): void {
  try {
    const database = getDatabase()

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      severity: getSeverity(eventType),
      userId: options.userId,
      userEmail: options.userEmail,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      resource: options.resource,
      action: options.action,
      details: typeof options.details === 'string'
        ? options.details
        : options.details
          ? JSON.stringify(options.details)
          : undefined,
      success: options.success ?? true,
    }

    const stmt = database.prepare(`
      INSERT INTO audit_logs (
        timestamp, event_type, severity, user_id, user_email,
        ip_address, user_agent, resource, action, details, success
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      entry.timestamp,
      entry.eventType,
      entry.severity,
      entry.userId ?? null,
      entry.userEmail ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      entry.resource ?? null,
      entry.action ?? null,
      entry.details ?? null,
      entry.success ? 1 : 0
    )

    // Also log to console for immediate visibility (in dev)
    if (process.env.NODE_ENV === 'development') {
      const logLevel = entry.severity === 'critical' || entry.severity === 'error' ? 'error' : 'log'
      console[logLevel](`[AUDIT] ${entry.eventType}`, {
        severity: entry.severity,
        user: entry.userEmail || entry.userId || 'anonymous',
        resource: entry.resource,
        success: entry.success,
      })
    }
  } catch (error) {
    // Don't let audit logging failures break the application
    console.error('[AUDIT ERROR] Failed to log audit event:', error)
  }
}

/**
 * Query audit logs
 */
export interface AuditLogQuery {
  eventType?: AuditEventType | AuditEventType[]
  severity?: AuditSeverity | AuditSeverity[]
  userId?: string
  startDate?: string
  endDate?: string
  resource?: string
  success?: boolean
  limit?: number
  offset?: number
}

/**
 * Get audit logs with optional filtering
 */
export function getAuditLogs(query: AuditLogQuery = {}): AuditLogEntry[] {
  try {
    const database = getDatabase()

    const conditions: string[] = []
    const params: unknown[] = []

    if (query.eventType) {
      if (Array.isArray(query.eventType)) {
        conditions.push(`event_type IN (${query.eventType.map(() => '?').join(',')})`)
        params.push(...query.eventType)
      } else {
        conditions.push('event_type = ?')
        params.push(query.eventType)
      }
    }

    if (query.severity) {
      if (Array.isArray(query.severity)) {
        conditions.push(`severity IN (${query.severity.map(() => '?').join(',')})`)
        params.push(...query.severity)
      } else {
        conditions.push('severity = ?')
        params.push(query.severity)
      }
    }

    if (query.userId) {
      conditions.push('user_id = ?')
      params.push(query.userId)
    }

    if (query.startDate) {
      conditions.push('timestamp >= ?')
      params.push(query.startDate)
    }

    if (query.endDate) {
      conditions.push('timestamp <= ?')
      params.push(query.endDate)
    }

    if (query.resource) {
      conditions.push('resource LIKE ?')
      params.push(`%${query.resource}%`)
    }

    if (query.success !== undefined) {
      conditions.push('success = ?')
      params.push(query.success ? 1 : 0)
    }

    let sql = 'SELECT * FROM audit_logs'
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY timestamp DESC'

    if (query.limit) {
      sql += ` LIMIT ${query.limit}`
    }
    if (query.offset) {
      sql += ` OFFSET ${query.offset}`
    }

    const rows = database.prepare(sql).all(...params) as {
      id: number
      timestamp: string
      event_type: string
      severity: string
      user_id: string | null
      user_email: string | null
      ip_address: string | null
      user_agent: string | null
      resource: string | null
      action: string | null
      details: string | null
      success: number
    }[]

    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type as AuditEventType,
      severity: row.severity as AuditSeverity,
      userId: row.user_id ?? undefined,
      userEmail: row.user_email ?? undefined,
      ipAddress: row.ip_address ?? undefined,
      userAgent: row.user_agent ?? undefined,
      resource: row.resource ?? undefined,
      action: row.action ?? undefined,
      details: row.details ?? undefined,
      success: row.success === 1,
    }))
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to query audit logs:', error)
    return []
  }
}

/**
 * Get security events summary for dashboard
 */
export interface SecuritySummary {
  totalEvents: number
  criticalEvents: number
  warningEvents: number
  recentFailedLogins: number
  pathTraversalAttempts: number
  rateLimitHits: number
}

export function getSecuritySummary(hours: number = 24): SecuritySummary {
  try {
    const database = getDatabase()
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const totalEvents = (database.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ?'
    ).get(since) as { count: number }).count

    const criticalEvents = (database.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND severity = ?'
    ).get(since, 'critical') as { count: number }).count

    const warningEvents = (database.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND severity = ?'
    ).get(since, 'warning') as { count: number }).count

    const recentFailedLogins = (database.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND event_type = ?'
    ).get(since, 'auth_login_failure') as { count: number }).count

    const pathTraversalAttempts = (database.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND event_type = ?'
    ).get(since, 'security_path_traversal') as { count: number }).count

    const rateLimitHits = (database.prepare(
      'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp >= ? AND event_type = ?'
    ).get(since, 'auth_rate_limited') as { count: number }).count

    return {
      totalEvents,
      criticalEvents,
      warningEvents,
      recentFailedLogins,
      pathTraversalAttempts,
      rateLimitHits,
    }
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to get security summary:', error)
    return {
      totalEvents: 0,
      criticalEvents: 0,
      warningEvents: 0,
      recentFailedLogins: 0,
      pathTraversalAttempts: 0,
      rateLimitHits: 0,
    }
  }
}

/**
 * Clean up old audit logs (retention policy)
 */
export function cleanupOldLogs(daysToKeep: number = 90): number {
  try {
    const database = getDatabase()
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

    const result = database.prepare('DELETE FROM audit_logs WHERE timestamp < ?').run(cutoff)
    return result.changes
  } catch (error) {
    console.error('[AUDIT ERROR] Failed to cleanup old logs:', error)
    return 0
  }
}

/**
 * Close the database connection (for graceful shutdown)
 */
export function closeAuditDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
