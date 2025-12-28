/**
 * JSON-LD Schema components for SEO structured data
 * Implements schema.org vocabulary for rich search results
 */

import React from 'react'

interface JsonLdProps {
  data: Record<string, unknown>
}

/**
 * Generic JSON-LD script injector
 * Renders a script tag with type="application/ld+json"
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          ...data,
        }),
      }}
    />
  )
}

/**
 * Organization schema - represents the site/company
 */
interface OrganizationSchemaProps {
  name: string
  url: string
  logo?: string
  description?: string
  sameAs?: string[] // Social media links
}

export function OrganizationSchema({
  name,
  url,
  logo,
  description,
  sameAs,
}: OrganizationSchemaProps) {
  const data: Record<string, unknown> = {
    '@type': 'Organization',
    name,
    url,
  }

  if (logo) data.logo = logo
  if (description) data.description = description
  if (sameAs && sameAs.length > 0) data.sameAs = sameAs

  return <JsonLd data={data} />
}

/**
 * WebSite schema - represents the website with search functionality
 */
interface WebSiteSchemaProps {
  name: string
  url: string
  description?: string
  searchUrl?: string // URL template for site search
}

export function WebSiteSchema({
  name,
  url,
  description,
  searchUrl,
}: WebSiteSchemaProps) {
  const data: Record<string, unknown> = {
    '@type': 'WebSite',
    name,
    url,
  }

  if (description) data.description = description

  if (searchUrl) {
    data.potentialAction = {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchUrl,
      },
      'query-input': 'required name=search_term_string',
    }
  }

  return <JsonLd data={data} />
}

/**
 * BlogPosting schema - represents a blog article
 */
interface ArticleSchemaProps {
  title: string
  description?: string
  url: string
  image?: string
  datePublished: string
  dateModified?: string
  author?: {
    name: string
    url?: string
  }
  publisher?: {
    name: string
    logo?: string
  }
  wordCount?: number
  keywords?: string[]
}

export function ArticleSchema({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  author,
  publisher,
  wordCount,
  keywords,
}: ArticleSchemaProps) {
  const data: Record<string, unknown> = {
    '@type': 'BlogPosting',
    headline: title,
    url,
    datePublished,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  }

  if (description) data.description = description
  if (image) data.image = image
  if (dateModified) data.dateModified = dateModified
  if (wordCount) data.wordCount = wordCount
  if (keywords && keywords.length > 0) data.keywords = keywords.join(', ')

  if (author) {
    data.author = {
      '@type': 'Person',
      name: author.name,
      ...(author.url && { url: author.url }),
    }
  }

  if (publisher) {
    data.publisher = {
      '@type': 'Organization',
      name: publisher.name,
      ...(publisher.logo && {
        logo: {
          '@type': 'ImageObject',
          url: publisher.logo,
        },
      }),
    }
  }

  return <JsonLd data={data} />
}

/**
 * BreadcrumbList schema - represents navigation breadcrumbs
 */
interface BreadcrumbItem {
  name: string
  url?: string
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const data = {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  }

  return <JsonLd data={data} />
}

/**
 * FAQPage schema - for FAQ sections
 */
interface FAQItem {
  question: string
  answer: string
}

interface FAQSchemaProps {
  items: FAQItem[]
}

export function FAQSchema({ items }: FAQSchemaProps) {
  const data = {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return <JsonLd data={data} />
}
