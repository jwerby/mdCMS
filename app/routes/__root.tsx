import { Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { ToastContainer } from '../../components/ui/Toast'
import { CommandPalette } from '../../components/seo/CommandPalette'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'
import { AccessibilityProvider, AccessibilityWidget } from '../../components/accessibility'
import { OrganizationSchema, WebSiteSchema } from '../../components/seo'
import { getSiteConfig } from '../../server/functions/site-config'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  loader: async () => {
    const siteConfig = await getSiteConfig()
    return { siteConfig }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'arrival-mdCMS - Markdown Content Management',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const { siteConfig } = Route.useLoaderData()

  return (
    <RootDocument siteConfig={siteConfig}>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children, siteConfig }: { children: React.ReactNode; siteConfig: Awaited<ReturnType<typeof getSiteConfig>> }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-slate-50 antialiased flex flex-col">
        <AccessibilityProvider>
          {/* JSON-LD Structured Data for SEO */}
          <OrganizationSchema
            name={siteConfig.siteName}
            url="/"
            description={siteConfig.blog?.description}
          />
          <WebSiteSchema
            name={siteConfig.siteName}
            url="/"
            description={siteConfig.blog?.description}
          />

          {/* Skip to main content link for keyboard users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]"
          >
            Skip to main content
          </a>

          <Header config={siteConfig} />

          <main id="main-content" role="main" className="flex-1">
            {children}
          </main>

          <Footer config={siteConfig} />

          <ToastContainer />
          <CommandPalette />
          <AccessibilityWidget />
        </AccessibilityProvider>
        <Scripts />
      </body>
    </html>
  )
}
