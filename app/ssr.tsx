/// <reference types="vinxi/types/server" />
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { getRouterManifest } from '@tanstack/react-start/router-manifest'
import { createRouter } from './router'
import { applySecurityHeaders, DEFAULT_SECURITY_CONFIG } from '../lib/security/headers'
import type { HTTPEvent } from 'vinxi/http'

// Custom stream handler that applies security headers
const secureStreamHandler: typeof defaultStreamHandler = async (ctx) => {
  // Apply security headers to the response
  if (ctx.event) {
    applySecurityHeaders(ctx.event as HTTPEvent, DEFAULT_SECURITY_CONFIG)
  }

  // Continue with the default stream handler
  return defaultStreamHandler(ctx)
}

export default createStartHandler({
  createRouter,
  getRouterManifest,
})(secureStreamHandler)
