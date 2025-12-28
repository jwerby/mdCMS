import { useMemo } from 'react'
import {
  Building, Image, Music, Leaf, Mic, Heart, Users, Palette, ChefHat,
  FileText, Send, Handshake, Bell, ArrowRight
} from 'lucide-react'
import { MarkdownRenderer } from '../editor/MarkdownRenderer'

interface Enhancement {
  target: string
  type: string
  style?: string
  includeChildren?: boolean
  columns?: number
  background?: string
  textColor?: string
  buttonStyle?: string
  icons?: Record<string, string>
}

interface HeroConfig {
  enabled: boolean
  source?: string
  style?: string
  gradient?: string
  textColor?: string
  includeSubtitle?: boolean
  includeButtons?: boolean
  minHeight?: string
  texture?: 'dots' | 'grid' | 'diagonal' | 'noise' | 'waves'
  backgroundImage?: string
  backgroundOverlay?: string
  overlayImage?: string
  overlayOpacity?: number
  // New bottom style options
  bottomStyle?: 'none' | 'wave' | 'angle' | 'angle-left' | 'curve' | 'fade'
  bottomHeight?: number // Height of the angled/curved bottom in pixels
  showGrain?: boolean   // Add subtle grain texture overlay
  grainOpacity?: number // Grain opacity (0-1)
}

interface EnhanceConfig {
  hero?: HeroConfig
  enhancements?: Enhancement[]
  footer?: {
    copyright?: string
    showContact?: boolean
  }
}

interface Section {
  id: string
  heading: string
  level: number
  content: string
  children: Section[]
}

interface EnhancedPageRendererProps {
  content: string
  enhanceConfig?: EnhanceConfig
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building,
  image: Image,
  music: Music,
  leaf: Leaf,
  mic: Mic,
  heart: Heart,
  users: Users,
  palette: Palette,
  'chef-hat': ChefHat,
  'file-text': FileText,
  send: Send,
  handshake: Handshake,
  bell: Bell,
}

function parseMarkdownSections(content: string): { hero: Section | null; sections: Section[] } {
  const lines = content.split('\n')
  const sections: Section[] = []
  let currentSection: Section | null = null
  let parentSection: Section | null = null  // Track parent h2 for adding h3 children
  let hero: Section | null = null
  let buffer: string[] = []

  const flushBuffer = () => {
    if (currentSection && buffer.length > 0) {
      currentSection.content = buffer.join('\n').trim()
      buffer = []
    }
  }

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/)
    const h2Match = line.match(/^## (.+)$/)
    const h3Match = line.match(/^### (.+)$/)

    if (h1Match && h1Match[1]) {
      flushBuffer()
      hero = {
        id: 'hero',
        heading: h1Match[1],
        level: 1,
        content: '',
        children: []
      }
      currentSection = hero
      parentSection = null
    } else if (h2Match && h2Match[1]) {
      flushBuffer()
      currentSection = {
        id: h2Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        heading: h2Match[1],
        level: 2,
        content: '',
        children: []
      }
      sections.push(currentSection)
      parentSection = currentSection  // This h2 becomes the parent for subsequent h3s
    } else if (h3Match && h3Match[1] && parentSection) {
      flushBuffer()
      const child: Section = {
        id: h3Match[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        heading: h3Match[1],
        level: 3,
        content: '',
        children: []
      }
      parentSection.children.push(child)
      currentSection = child
    } else {
      buffer.push(line)
    }
  }
  flushBuffer()

  return { hero, sections }
}

function extractButtons(content: string): { text: string; href: string }[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const buttons: { text: string; href: string }[] = []
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      buttons.push({ text: match[1], href: match[2] })
    }
  }
  return buttons
}

// Texture patterns as inline SVG data URIs
const textures = {
  dots: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='white' fill-opacity='0.1'/%3E%3C/svg%3E")`,
  grid: `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='white' stroke-opacity='0.05'/%3E%3C/svg%3E")`,
  diagonal: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20L20 0' stroke='white' stroke-opacity='0.05'/%3E%3C/svg%3E")`,
  noise: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E")`,
  waves: `url("data:image/svg+xml,%3Csvg width='100' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q25 0 50 10 T100 10' fill='none' stroke='white' stroke-opacity='0.05'/%3E%3C/svg%3E")`,
}

// Get clip-path for bottom styles
function getBottomClipPath(style: string, height: number): string {
  switch (style) {
    case 'angle':
      return `polygon(0 0, 100% 0, 100% calc(100% - ${height}px), 0 100%)`
    case 'angle-left':
      return `polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - ${height}px))`
    case 'curve':
      return `ellipse(80% 100% at 50% 0%)`
    case 'fade':
    case 'wave':
    case 'none':
    default:
      return 'none'
  }
}

function HeroSection({ section, config }: { section: Section; config: HeroConfig }) {
  const buttons = extractButtons(section.content)
  const subtitle = section.content.split('\n').find(l => l.trim() && !l.startsWith('['))
  const textureStyle = config.texture ? textures[config.texture as keyof typeof textures] : undefined
  const hasBackgroundImage = !!config.backgroundImage
  const hasOverlayImage = !!config.overlayImage
  const overlayOpacity = config.overlayOpacity ?? 0.3
  const bottomStyle = config.bottomStyle || 'none'
  const bottomHeight = config.bottomHeight ?? 80
  const showGrain = config.showGrain ?? false
  const grainOpacity = config.grainOpacity ?? 0.15
  const clipPath = getBottomClipPath(bottomStyle, bottomHeight)

  // Calculate extra padding at bottom for angled styles
  const needsBottomPadding = ['angle', 'angle-left', 'curve'].includes(bottomStyle)

  return (
    <section
      className={`relative flex items-center justify-center ${!hasBackgroundImage ? `bg-gradient-to-br ${config.gradient || 'from-slate-900 to-indigo-900'}` : ''}`}
      style={{
        minHeight: config.minHeight || '70vh',
        clipPath: clipPath !== 'none' ? clipPath : undefined,
        paddingBottom: needsBottomPadding ? `${bottomHeight}px` : undefined
      }}
    >
      {/* Background Image (main photo/image) */}
      {hasBackgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${config.backgroundImage})` }}
        />
      )}
      {/* Gradient overlay for background image */}
      {hasBackgroundImage && (
        <div className={`absolute inset-0 bg-gradient-to-br ${config.backgroundOverlay || 'from-slate-900/80 to-indigo-900/60'}`} />
      )}
      {/* Overlay Image (decorative SVG/pattern on top of gradient) */}
      {hasOverlayImage && (
        <div className="absolute inset-x-0 bottom-0 pointer-events-none">
          <img
            src={config.overlayImage}
            alt=""
            className="w-full h-auto block"
            style={{ opacity: overlayOpacity }}
          />
        </div>
      )}
      {/* Texture overlay */}
      {textureStyle && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: textureStyle, backgroundRepeat: 'repeat' }}
        />
      )}
      {/* Grain texture overlay */}
      {showGrain && (
        <>
          <svg className="absolute w-0 h-0">
            <defs>
              <filter id="grain-filter">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
            </defs>
          </svg>
          <div
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{
              filter: 'url(#grain-filter)',
              opacity: grainOpacity
            }}
          />
        </>
      )}
      {/* Fade gradient at bottom */}
      {bottomStyle === 'fade' && (
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-white to-transparent"
          style={{ height: `${bottomHeight}px` }}
        />
      )}
      {!hasBackgroundImage && !hasOverlayImage && !showGrain && <div className="absolute inset-0 bg-black/20" />}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight">
          {section.heading}
        </h1>
        {config.includeSubtitle && subtitle && (
          <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}
        {config.includeButtons && buttons.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {buttons.map((btn, i) => (
              <a
                key={i}
                href={btn.href}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  i === 0
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-white/10 text-white border border-white/30 hover:bg-white/20'
                }`}
              >
                {btn.text}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function CardGrid({
  section,
  enhancement
}: {
  section: Section
  enhancement: Enhancement
}) {
  const columns = enhancement.columns || 3
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'md:grid-cols-3'

  return (
    <section className={`py-16 ${enhancement.background ? `bg-${enhancement.background}` : 'bg-slate-50'}`}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-4 text-center">{section.heading}</h2>
        {section.content && (
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">{section.content}</p>
        )}
        <div className={`grid ${gridCols} gap-6`}>
          {section.children.map((child, i) => {
            const iconName = enhancement.icons?.[child.heading] || 'file-text'
            const Icon = iconMap[iconName] || FileText

            return (
              <div
                key={i}
                className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{child.heading}</h3>
                <p className="text-sm text-slate-600">{child.content}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CtaSection({ section, enhancement }: { section: Section; enhancement: Enhancement }) {
  const buttons = extractButtons(section.content)
  const text = section.content.split('\n').find(l => l.trim() && !l.startsWith('['))

  const bgClass = enhancement.background === 'slate-900'
    ? 'bg-slate-900'
    : enhancement.background === 'indigo-600'
    ? 'bg-indigo-600'
    : 'bg-slate-100'

  const textClass = enhancement.textColor === 'white' ? 'text-white' : 'text-slate-800'

  return (
    <section className={`py-16 ${bgClass}`}>
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className={`text-3xl font-bold mb-4 ${textClass}`}>{section.heading}</h2>
        {text && (
          <p className={`text-lg mb-8 ${enhancement.textColor === 'white' ? 'text-white/80' : 'text-slate-600'}`}>
            {text}
          </p>
        )}
        {buttons.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {buttons.map((btn, i) => (
              <a
                key={i}
                href={btn.href}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  enhancement.buttonStyle === 'white'
                    ? 'bg-white text-indigo-600 hover:bg-slate-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {btn.text}
                <ArrowRight className="w-4 h-4" />
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function CtaBanner({ section, enhancement }: { section: Section; enhancement: Enhancement }) {
  return (
    <section className="py-12 bg-indigo-600">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">{section.heading}</h2>
        <p className="text-indigo-100">{section.content}</p>
      </div>
    </section>
  )
}

function DefaultSection({ section }: { section: Section }) {
  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">{section.heading}</h2>
        <div className="prose prose-slate max-w-none">
          <MarkdownRenderer content={section.content} />
        </div>
        {section.children.length > 0 && (
          <div className="mt-8 space-y-6">
            {section.children.map((child, i) => (
              <div key={i}>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{child.heading}</h3>
                <p className="text-slate-600">{child.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function EnhancedPageRenderer({ content, enhanceConfig }: EnhancedPageRendererProps) {
  const { hero, sections } = useMemo(() => parseMarkdownSections(content), [content])

  const getEnhancement = (heading: string): Enhancement | undefined => {
    return enhanceConfig?.enhancements?.find(e => e.target === `## ${heading}`)
  }

  const renderSection = (section: Section) => {
    const enhancement = getEnhancement(section.heading)

    if (!enhancement) {
      return <DefaultSection key={section.id} section={section} />
    }

    switch (enhancement.type) {
      case 'card-grid':
        return <CardGrid key={section.id} section={section} enhancement={enhancement} />
      case 'cta-section':
        return <CtaSection key={section.id} section={section} enhancement={enhancement} />
      case 'cta-banner':
        return <CtaBanner key={section.id} section={section} enhancement={enhancement} />
      default:
        return <DefaultSection key={section.id} section={section} />
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      {hero && enhanceConfig?.hero?.enabled && (
        <HeroSection section={hero} config={enhanceConfig.hero} />
      )}

      {/* Sections */}
      {sections.map(renderSection)}

      {/* Footer */}
      {enhanceConfig?.footer && (
        <footer className="py-8 bg-slate-900 text-center">
          <p className="text-slate-400 text-sm">
            &copy; {enhanceConfig.footer.copyright}
          </p>
        </footer>
      )}
    </div>
  )
}
