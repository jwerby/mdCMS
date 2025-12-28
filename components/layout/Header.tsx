import { Link, useLocation } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import type { SiteConfig } from '../../server/functions/site-config'

interface HeaderProps {
  config: SiteConfig
}

export function Header({ config }: HeaderProps) {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')
  const isHomePage = location.pathname === '/'

  // Don't show site header on dashboard pages (they have their own)
  // Don't show on home page either (it has its own floating header for the hero)
  if (isDashboard || isHomePage) return null

  return (
    <header role="banner" className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to={config.header.logo.href}
              className="text-xl font-bold text-slate-800 hover:text-indigo-600 transition-colors no-underline"
              aria-label={`${config.header.logo.text} - Home`}
            >
              {config.header.logo.text}
            </Link>
            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
              {config.header.navigation.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          {config.header.showDashboardLink && (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
