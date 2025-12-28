import { Link, useLocation } from '@tanstack/react-router'
import type { SiteConfig } from '../../server/functions/site-config'

interface FooterProps {
  config: SiteConfig
}

export function Footer({ config }: FooterProps) {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')

  // Don't show site footer on dashboard pages
  if (isDashboard) return null

  return (
    <footer role="contentinfo" className="bg-slate-900 text-slate-400 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-sm">
            {config.footer.copyright}
          </div>
          {config.footer.links.length > 0 && (
            <nav aria-label="Footer navigation" className="flex items-center gap-6">
              {config.footer.links.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
          {config.footer.showPoweredBy && (
            <div className="text-sm text-slate-500">
              Powered by arrival-mdCMS
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
