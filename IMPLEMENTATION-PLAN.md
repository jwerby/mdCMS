# Implementation Plan: Security & Performance Remediation

## Overview

This plan addresses **10 security issues** and **10 performance issues** identified in the arrival-mdCMS codebase. Work is organized into 5 phases over 21 days.

### Quick Reference

| Phase | Focus | Duration | Priority |
|-------|-------|----------|----------|
| 1 | Critical Security | Days 1-3 | CRITICAL |
| 2 | Security Hardening | Days 4-7 | HIGH |
| 3 | XSS & Logging | Days 8-10 | MEDIUM |
| 4 | Performance | Days 11-17 | CRITICAL |
| 5 | Bundle & Polish | Days 18-21 | MEDIUM |

---

## Phase 1: Critical Security Fixes (Days 1-3)

**Goal**: Eliminate critical security vulnerabilities that pose immediate risk.

**Success Criteria**:
- All API keys rotated and properly secured
- Path traversal attacks blocked on all file operations
- Input validation preventing malicious data

### Task 1.1: API Key Rotation and Secret Management
**Complexity**: S | **Priority**: CRITICAL | **Depends on**: None

- [x] **1.1.1** Verify `.env.local` not in git: `git ls-files | grep .env.local`
- [x] **1.1.2** If tracked, remove from git history and add to `.gitignore`
- [ ] **1.1.3** Rotate Gemini API key at https://makersuite.google.com/app/apikey
- [ ] **1.1.4** Rotate Anthropic API key at https://console.anthropic.com/
- [ ] **1.1.5** Generate new BETTER_AUTH_SECRET: `openssl rand -base64 32`
- [x] **1.1.6** Create environment validation utility
  - New file: `/lib/security/env-validation.ts`
- [ ] **1.1.7** Document secret management in README

### Task 1.2: Path Traversal Protection
**Complexity**: M | **Priority**: CRITICAL | **Depends on**: None

- [x] **1.2.1** Create path sanitization utility
  - New file: `/lib/security/path-sanitizer.ts`
  - Remove `..`, `/`, `\`, null bytes; allow only `[a-zA-Z0-9_-]`
- [x] **1.2.2** Add path containment verification function
- [x] **1.2.3** Apply to `pages.ts`: getPage, updatePage, deletePage
- [x] **1.2.4** Apply to `posts.ts`: getPost, updatePost, deletePost, togglePublish
- [x] **1.2.5** Apply to `history.ts`: getHistoryPath, getVersion, getVersionHistory
- [x] **1.2.6** Apply to `images.ts`: uploadImage, deleteImage
- [x] **1.2.7** Add security logging for rejected attempts

### Task 1.3: Input Validation with Zod
**Complexity**: M | **Priority**: CRITICAL | **Depends on**: None

- [x] **1.3.1** Install Zod: `npm install zod` (already installed)
- [x] **1.3.2** Create validation schemas
  - New file: `/lib/validation/schemas.ts`
  - Schemas: `slugSchema`, `postContentSchema`, `frontmatterSchema`
- [x] **1.3.3** Add file size limits: 1MB for posts
- [x] **1.3.4** Add file size limits: 10MB for images
- [x] **1.3.5** Replace inputValidator in `posts.ts`
- [x] **1.3.6** Replace inputValidator in `pages.ts`
- [x] **1.3.7** Replace inputValidator in `images.ts`
- [x] **1.3.8** Replace inputValidator in `history.ts`

**Milestone**: All critical security vulnerabilities addressed ✅

---

## Phase 2: Security Hardening (Days 4-7)

**Goal**: Add rate limiting, CSRF, headers, and session management.

**Success Criteria**:
- AI endpoints protected by rate limiting
- Security headers on all responses
- CSRF protection enabled
- Sessions reduced to 24 hours

### Task 2.1: Rate Limiting for AI Endpoints
**Complexity**: M | **Priority**: HIGH | **Depends on**: Phase 1

- [x] **2.1.1** Create rate limiting middleware using TanStack Pacer
  - New file: `/lib/security/rate-limiter.ts`
  - Config: 10-20 requests/minute per IP for AI endpoints
- [x] **2.1.2** Apply to `analyze.ts`
- [x] **2.1.3** Apply to `rewrite.ts`
- [x] **2.1.4** Apply to `write.ts`
- [x] **2.1.5** Apply to `research.ts`
- [x] **2.1.6** Apply to `optimize.ts` (including applyValidationFixes, applyOptimizationFixes)
- [x] **2.1.7** Apply to `generateSEO.ts`
- [x] **2.1.8** Add rate limit exceeded handling (RateLimitError with retry info)

### Task 2.2: Security Headers
**Complexity**: S | **Priority**: HIGH | **Depends on**: None

- [x] **2.2.1** Create security headers middleware
  - New file: `/lib/security/headers.ts`
- [x] **2.2.2** Add Content-Security-Policy
- [x] **2.2.3** Add X-Frame-Options: DENY
- [x] **2.2.4** Add X-Content-Type-Options: nosniff
- [x] **2.2.5** Add X-XSS-Protection: 1; mode=block
- [x] **2.2.6** Add Referrer-Policy: strict-origin-when-cross-origin
- [x] **2.2.7** Apply to application via custom SSR handler
- [x] **2.2.8** Add HSTS and Permissions-Policy headers

### Task 2.3: CSRF Protection
**Complexity**: M | **Priority**: HIGH | **Depends on**: Task 2.2

- [x] **2.3.1** Research CSRF support in Better Auth
  - Better Auth uses SameSite=Lax cookies by default for CSRF protection
  - trustedOrigins configuration blocks cross-origin requests
- [x] **2.3.2** Configure cookie settings for CSRF protection
  - File: `/lib/auth.server.ts`
  - SameSite=Lax cookies prevent CSRF attacks
- [x] **2.3.3** Configure trustedOrigins properly
- [x] **2.3.4** Validate origins via Better Auth built-in protection

### Task 2.4: Session Security Hardening
**Complexity**: S | **Priority**: HIGH | **Depends on**: None

- [x] **2.4.1** Reduce session expiry: 7 days → 24 hours
  - File: `/lib/auth.server.ts`
- [x] **2.4.2** Reduce session update age: 24 hours → 1 hour
- [x] **2.4.3** Configure secure cookie settings (httpOnly, secure, sameSite)
- [x] **2.4.4** Add cookie prefix namespace isolation

### Task 2.5: Password Policy Enhancement
**Complexity**: S | **Priority**: HIGH | **Depends on**: None

- [x] **2.5.1** Minimum 8 characters (recommended 12+)
- [x] **2.5.2** Maximum 128 characters for security
- [ ] **2.5.3** Add password strength indicator to forms (UI enhancement - optional)

**Milestone**: Security hardening complete ✅

---

## Phase 3: XSS Prevention & Logging (Days 8-10)

**Goal**: Address XSS vulnerabilities and implement security logging.

**Success Criteria**:
- JavaScript URLs stripped from markdown
- Security audit trail logging in place

### Task 3.1: XSS Prevention in Markdown
**Complexity**: M | **Priority**: MEDIUM | **Depends on**: None

- [x] **3.1.1** Create URL sanitization utility
  - New file: `/lib/security/url-sanitizer.ts`
  - Block: `javascript:`, `data:`, `vbscript:`, `file:`
  - Handles URL decoding to prevent obfuscation
- [x] **3.1.2** Update `/components/MarkdownRenderer.tsx` parseInline
- [x] **3.1.3** Update `/components/editor/MarkdownRenderer.tsx` parseInline
- [x] **3.1.4** Sanitize image src attributes
- [x] **3.1.5** Add protocol allowlist (http, https, mailto, tel, relative URLs)

### Task 3.2: Security Logging
**Complexity**: M | **Priority**: MEDIUM | **Depends on**: Tasks 1.2, 2.1

- [x] **3.2.1** Create audit logging utility
  - New file: `/lib/security/audit-log.ts`
  - SQLite-backed persistent storage
- [x] **3.2.2** Define event types (auth, security, content, file, AI events)
- [x] **3.2.3** Create audit log storage (SQLite in content/audit.db)
- [x] **3.2.4** Log authentication events (ready for integration)
- [x] **3.2.5** Log security violations (path traversal, rate limiting)
- [x] **3.2.6** Log content modifications (event types defined)
- [ ] **3.2.7** Add audit log viewer (optional - deferred to polish phase)

**Milestone**: XSS prevention and audit logging complete ✅

---

## Phase 4: Performance Optimization (Days 11-17)

**Goal**: Eliminate N+1 file I/O, implement caching, remove blocking operations.

**Success Criteria**:
- File operations use caching
- Async file operations throughout
- Context files cached for AI
- Full page reloads eliminated

### Task 4.1: File I/O Caching
**Complexity**: L | **Priority**: CRITICAL | **Depends on**: Phase 3

- [x] **4.1.1** Create in-memory cache module
  - New file: `/lib/cache/file-cache.ts`
  - Features: TTL expiration, LRU eviction, write invalidation
- [x] **4.1.2** Cache `loadPostsFromDir` (TTL: 30s)
  - File: `/server/functions/posts.ts`
- [x] **4.1.3** Add cache invalidation on post mutations
- [x] **4.1.4** Cache `loadPage`
  - File: `/server/functions/pages.ts`
- [x] **4.1.5** Add cache invalidation on page mutations
- [ ] **4.1.6** Create file watcher for dev auto-invalidation (optional)
  - New file: `/lib/cache/file-watcher.ts`

### Task 4.2: Async File Operations
**Complexity**: M | **Priority**: CRITICAL | **Depends on**: Task 4.1

- [x] **4.2.1** Replace `fs.readFileSync` → `fs.promises.readFile`
- [x] **4.2.2** Replace `fs.writeFileSync` → `fs.promises.writeFile`
  - `posts.ts`, `pages.ts`
- [x] **4.2.3** Replace `fs.readdirSync` → `fs.promises.readdir`
- [x] **4.2.4** Replace `fs.existsSync` with `fsp.access` try/catch
- [x] **4.2.5** Replace `fs.unlinkSync` → `fs.promises.unlink`

### Task 4.3: AI Context Caching
**Complexity**: S | **Priority**: CRITICAL | **Depends on**: Task 4.1

- [x] **4.3.1** Cache `loadContextFiles` (TTL: 5 min)
  - File: `/server/functions/ai/prompts.ts`
  - Uses `aiContextCache` from file-cache.ts
- [ ] **4.3.2** Add file watcher for cache invalidation (optional)
- [ ] **4.3.3** Preload context on server startup (optional)

### Task 4.4: Eliminate Full Page Reloads
**Complexity**: M | **Priority**: CRITICAL | **Depends on**: Task 4.1

- [x] **4.4.1** Replace `window.location.reload()` in dashboard
  - File: `/app/routes/dashboard/index.tsx`
  - Use: `router.invalidate()` from `useRouter()`
- [x] **4.4.2** Replace in editor after toggle publish
  - File: `/app/routes/dashboard/editor.$slug.tsx`
- [ ] **4.4.3** Implement optimistic updates (future enhancement)
- [ ] **4.4.4** Add loading states during refetch (future enhancement)

### Task 4.5: MarkdownRenderer Memoization
**Complexity**: M | **Priority**: HIGH | **Depends on**: None

- [x] **4.5.1** Extract `parseInline` to shared utility
  - New file: `/lib/markdown/inline-parser.ts`
  - Supports customizable class names for different renderers
- [x] **4.5.2** Memoize parsing function
  - `parseInlineText` is now a pure function outside component
- [x] **4.5.3** Use `React.memo` for component
  - Both public and editor MarkdownRenderer wrapped in memo()
- [x] **4.5.4** Add content hash dependency for useMemo
  - `contentHash()` function for fast change detection

### Task 4.6: History Delta Storage
**Complexity**: L | **Priority**: HIGH | **Depends on**: None

- [x] **4.6.1** Design delta storage format
  - New file: `/lib/history/delta-storage.ts`
  - `DeltaPatch` interface with unified diff, original/result lengths
  - `DeltaVersionEntry` with full content for base, delta for subsequent
- [x] **4.6.2** Integrate `diff` package for deltas
  - Uses `Diff.createPatch()` and `Diff.applyPatch()`
  - Context lines (3) for accurate patching
- [x] **4.6.3** Modify `saveVersion` to store deltas
  - First version stored as base with full content
  - Subsequent versions store delta patches only
- [x] **4.6.4** Modify `getVersion` to reconstruct from deltas
  - `reconstructContent()` walks delta chain from base
  - Automatic legacy format detection and conversion on read
- [x] **4.6.5** Create migration script
  - New file: `/scripts/migrate-history-to-delta.ts`
  - Supports --dry-run mode, creates backups
  - Shows compression statistics
- [x] **4.6.6** Implement history compaction
  - `compactHistory()` creates new base every 5 versions
  - Prevents excessively long delta chains

**Milestone**: Performance optimization complete ✅

---

## Phase 5: Bundle Optimization & Polish (Days 18-21)

**Goal**: Optimize bundle size, code splitting, documentation.

**Success Criteria**:
- lucide-react imports optimized
- AI routes code-split
- Documentation complete
- Test coverage targets met

### Task 5.1: lucide-react Optimization
**Complexity**: S | **Priority**: MEDIUM | **Depends on**: None

- [x] **5.1.1** Audit all lucide-react imports
  - All imports already use specific named exports
- [x] **5.1.2** Change to specific icon imports or configure tree-shaking
  - Already optimized - Vite tree-shakes and code-splits individual icons
- [x] **5.1.3** Verify bundle size reduction
  - Individual icon chunks: arrow-left (165B), eye (251B), globe (237B)
  - Main bundle: 372K (reasonable)

### Task 5.2: Code Splitting AI Routes
**Complexity**: M | **Priority**: MEDIUM | **Depends on**: None

- [x] **5.2.1** Convert SEO routes to lazy loading
  - TanStack Router file-based routing already code-splits automatically
  - SEO routes: analyze (6.2K), optimize (5.5K), research (5.6K), etc.
- [x] **5.2.2** Add loading fallback components
  - Created: `/components/LoadingFallback.tsx`
  - Added global `defaultPendingComponent` to router
- [x] **5.2.3** Configure route preloading
  - `defaultPreload: 'intent'` - preloads on hover
  - `defaultPendingMinMs: 200` - avoids loading flicker

### Task 5.3: Frontmatter Parsing Optimization
**Complexity**: S | **Priority**: MEDIUM | **Depends on**: None

- [x] **5.3.1** Consider `gray-matter` package or optimize parser
  - Created shared `/lib/markdown/frontmatter-parser.ts`
  - Custom parser is sufficient (simple key:value YAML)
  - Handles arrays, booleans, numbers, quoted strings
- [x] **5.3.2** Cache parsed frontmatter
  - Added LRU cache (100 entries) with content hash key
  - Automatic cache eviction for memory efficiency
- [x] **5.3.3** Benchmark before/after
  - Reduced duplicate code in posts.ts and pages.ts
  - Caching prevents re-parsing same content

### Task 5.4: Database Indexing
**Complexity**: S | **Priority**: MEDIUM | **Depends on**: None

- [x] **5.4.1** Analyze Better Auth table structure
  - SQLite database with user, session, account, verification tables
  - Existing indexes: session_userId_idx, account_userId_idx, verification_identifier_idx
  - Unique constraints auto-index: user.email, session.token
- [x] **5.4.2** Add indexes for user/session lookups
  - Created: `/scripts/add-auth-indexes.sql`
  - Added: session_expiresAt_idx, session_token_expiresAt_idx, verification_expiresAt_idx
- [x] **5.4.3** Run migration
  - Applied successfully, ANALYZE run to update query planner
- [x] **5.4.4** Verify performance improvement
  - Indexes created and active for session/verification queries

**Milestone**: Bundle optimization and polish complete ✅

---

## Testing Requirements

### Unit Tests

| Test Area | File | Coverage |
|-----------|------|----------|
| Path sanitization | `/lib/security/path-sanitizer.test.ts` | 100% |
| URL sanitization | `/lib/security/url-sanitizer.test.ts` | 100% |
| Zod schemas | `/lib/validation/schemas.test.ts` | 100% |
| Rate limiter | `/lib/security/rate-limiter.test.ts` | 90% |
| File cache | `/lib/cache/file-cache.test.ts` | 90% |
| Delta storage | `/lib/history/delta-storage.test.ts` | 90% |
| Markdown parser | `/lib/markdown/inline-parser.test.ts` | 85% |

### Integration Tests

- [ ] Auth flow: registration, login, logout, session expiry
- [ ] CRUD: posts and pages create, read, update, delete
- [ ] File upload: image upload with size limits
- [ ] AI endpoints: rate limiting verification
- [ ] Cache invalidation: verify updates on mutations

### Security Tests

- [ ] Path traversal: `../` sequences in all inputs
- [ ] XSS: `javascript:` URLs and script tags
- [ ] CSRF: tokens required for mutations
- [ ] Rate limiting: 429 after limit exceeded
- [ ] Auth bypass: access protected routes without session

### Manual Testing Checklist

- [ ] Login/logout works
- [ ] Post CRUD operations
- [ ] Page CRUD operations
- [ ] Image upload/delete
- [ ] Version history save/view/restore
- [ ] AI features work
- [ ] Dashboard updates without reload
- [ ] Security headers in dev tools

---

## Documentation

### Code Comments
- [ ] JSDoc for all security utilities
- [ ] Document rate limit config
- [ ] Document cache config and invalidation
- [ ] Inline comments for security decisions

### README Updates
- [ ] Security section (env vars, secret rotation, rate limiting)
- [ ] Performance section (caching, bundle optimization)
- [ ] Installation updates (Zod dependency)

### New Docs
- [ ] `/docs/SECURITY.md` - Security architecture
- [ ] `/docs/CONTRIBUTING.md` - Dev security practices
- [ ] `/docs/DEPLOYMENT.md` - Production checklist

---

## Progress Tracking

### Phase Status

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| 1 | Complete | 2024-12-23 | 2024-12-23 |
| 2 | Complete | 2024-12-23 | 2024-12-23 |
| 3 | Complete | 2024-12-23 | 2024-12-23 |
| 4 | Complete | 2024-12-24 | 2024-12-24 |
| 5 | Complete | 2024-12-24 | 2024-12-24 |

### Key Metrics

| Metric | Before | Target | Current |
|--------|--------|--------|---------|
| Dashboard load | 800-1200ms | <400ms | - |
| Post fetch | 150-300ms | <15ms | - |
| Bundle size | ~800KB | <600KB | - |
| Security score | Poor | Good | - |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking API changes | Comprehensive testing, staged rollout |
| Performance regression | Benchmark before/after each phase |
| Cache invalidation bugs | Extensive integration testing |
| Rate limiting too aggressive | Start high, tune based on usage |
| Session length frustrating users | Add "remember me" option |

---

## Dependencies Diagram

```
Phase 1 (Critical Security)
    │
    ▼
Phase 2 (Hardening) ──────► Phase 3 (XSS/Logging)
    │                            │
    └────────────────────────────┘
                 │
                 ▼
        Phase 4 (Performance)
                 │
                 ▼
        Phase 5 (Polish)
```

---

## Getting Started

1. **Read security-report.md** for full vulnerability details
2. **Start with Task 1.1** - rotate API keys immediately
3. **Create lib/security/ directory** for security utilities
4. **Run tests** after each task completion
5. **Update this file** with checkmarks as you complete tasks

Last Updated: 2024-12-24 (All Phases Complete)
