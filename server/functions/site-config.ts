import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'content', 'site-config.json')

const NavLinkSchema = z.object({
  label: z.string(),
  href: z.string()
})

const BlogConfigSchema = z.object({
  template: z.enum(['columns', 'cards', 'list', 'mosaic']).default('columns'),
  postsPerPage: z.number().min(4).max(24).default(12),
  showExcerpt: z.boolean().default(true),
  showThumbnail: z.boolean().default(true),
  showReadTime: z.boolean().default(true),
  showDate: z.boolean().default(true),
  title: z.string().default('Blog'),
  description: z.string().optional()
})

export type BlogConfig = z.infer<typeof BlogConfigSchema>
export type BlogTemplate = BlogConfig['template']

const SiteConfigSchema = z.object({
  siteName: z.string(),
  header: z.object({
    logo: z.object({
      text: z.string(),
      href: z.string()
    }),
    navigation: z.array(NavLinkSchema),
    showDashboardLink: z.boolean()
  }),
  footer: z.object({
    copyright: z.string(),
    links: z.array(NavLinkSchema),
    showPoweredBy: z.boolean()
  }),
  blog: BlogConfigSchema.optional()
})

export type SiteConfig = z.infer<typeof SiteConfigSchema>

const defaultBlogConfig: BlogConfig = {
  template: 'columns',
  postsPerPage: 12,
  showExcerpt: true,
  showThumbnail: true,
  showReadTime: true,
  showDate: true,
  title: 'Blog',
  description: 'Latest articles and insights'
}

export { defaultBlogConfig }

const defaultConfig: SiteConfig = {
  siteName: 'arrival-mdCMS',
  header: {
    logo: { text: 'arrival-mdCMS', href: '/' },
    navigation: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/blog' }
    ],
    showDashboardLink: true
  },
  footer: {
    copyright: '2025 arrival-mdCMS. All rights reserved.',
    links: [],
    showPoweredBy: true
  },
  blog: defaultBlogConfig
}

export const getSiteConfig = createServerFn({ method: 'GET' })
  .handler(async () => {
    try {
      const data = await fs.readFile(CONFIG_PATH, 'utf-8')
      return JSON.parse(data) as SiteConfig
    } catch {
      // Return default config if file doesn't exist
      return defaultConfig
    }
  })

export const updateSiteConfig = createServerFn({ method: 'POST' })
  .inputValidator(SiteConfigSchema)
  .handler(async ({ data }) => {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  })
