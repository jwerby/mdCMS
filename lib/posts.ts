import { Post, Directory } from '../types';

interface PostFrontmatter {
  // Standard format
  title?: string;
  description?: string;
  date?: string;
  author?: string;
  authorId?: string;
  category?: string;
  tags?: string[];
  thumbnail?: string;
  views?: number;
  likes?: number;
  // SEO Machine format (arrivalvb.com) - with underscores
  meta_title?: string;
  meta_description?: string;
  primary_keyword?: string;
  secondary_keywords?: string[];
  url_slug?: string;
  published_date?: string;
  // Legacy format with spaces
  'Meta Title'?: string;
  'Meta Description'?: string;
  'Primary Keyword'?: string;
  'Secondary Keywords'?: string;
  'URL Slug'?: string;
}

function parseFrontmatter(content: string): { frontmatter: PostFrontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  // If no frontmatter, extract title from first heading and use content as body
  if (!match) {
    const lines = content.split('\n');
    const firstHeading = lines.find(l => l.startsWith('# '));
    const title = firstHeading ? firstHeading.replace(/^#\s+/, '') : 'Untitled';

    // Try to get first paragraph as description
    const bodyStart = firstHeading ? lines.indexOf(firstHeading) + 1 : 0;
    const firstParagraph = lines.slice(bodyStart).find(l => l.trim() && !l.startsWith('#') && !l.startsWith('*'));

    return {
      frontmatter: {
        title,
        description: firstParagraph?.slice(0, 200) || '',
      } as PostFrontmatter,
      body: content
    };
  }

  const frontmatterStr = match[1];
  const body = match[2];

  // Simple YAML parser for our needs
  const frontmatter: Record<string, any> = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle arrays (tags)
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1);
      frontmatter[key] = value.split(',').map(s => s.trim().replace(/['"]/g, ''));
    }
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) ||
             (value.startsWith("'") && value.endsWith("'"))) {
      frontmatter[key] = value.slice(1, -1);
    }
    // Handle numbers
    else if (!isNaN(Number(value)) && value !== '') {
      frontmatter[key] = Number(value);
    }
    // Plain string
    else {
      frontmatter[key] = value;
    }
  }

  return { frontmatter: frontmatter as PostFrontmatter, body };
}

function getSlugFromFilename(filename: string): string {
  // Remove .md extension and any date suffix like -2025-12-19
  return filename.replace(/\.md$/, '').replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

function normalizePost(frontmatter: PostFrontmatter, body: string, filenameSlug: string, directory: Directory, fileContent: string): Post {
  // Prefer slug from frontmatter (url_slug), fall back to filename-derived slug
  const slugFromFrontmatter = frontmatter.url_slug?.replace(/^\/blog\//, '').replace(/^\//, '') || frontmatter['URL Slug']?.replace(/^\/blog\//, '').replace(/^\//, '');
  const slug = slugFromFrontmatter || filenameSlug;
  // Handle SEO Machine format (underscore), legacy format (spaces), and standard format
  const title = frontmatter.title || frontmatter.meta_title || frontmatter['Meta Title'] || slug;
  const description = frontmatter.description || frontmatter.meta_description || frontmatter['Meta Description'] || '';

  // Extract tags from secondary_keywords or Secondary Keywords
  let tags: string[] = frontmatter.tags || [];
  if (frontmatter.secondary_keywords && Array.isArray(frontmatter.secondary_keywords)) {
    tags = frontmatter.secondary_keywords;
  } else if (frontmatter['Secondary Keywords']) {
    tags = frontmatter['Secondary Keywords'].split(',').map(s => s.trim());
  }

  // Add primary keyword to tags if not already included
  const primaryKeyword = frontmatter.primary_keyword || frontmatter['Primary Keyword'];
  if (primaryKeyword && !tags.includes(primaryKeyword)) {
    tags.unshift(primaryKeyword);
  }

  // Derive category from primary keyword or first tag
  const category = frontmatter.category || primaryKeyword?.split(' ')[0] || 'Community';

  // Handle date formats
  let date = frontmatter.date;
  if (!date && frontmatter.published_date) {
    // Convert YYYY-MM-DD to readable format
    const d = new Date(frontmatter.published_date);
    date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (!date) {
    date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  return {
    slug,
    title,
    description,
    date,
    authorId: frontmatter.authorId || 'lisa-jeff',
    author: frontmatter.author || 'Lisa & Jeff',
    category,
    thumbnail: frontmatter.thumbnail || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    content: body,
    directory,
    tags,
    size: calculateSize(fileContent),
    views: frontmatter.views || 0,
    likes: frontmatter.likes || 0,
  };
}

function calculateSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes}b`;
  return `${(bytes / 1024).toFixed(1)}kb`;
}

export function loadPosts(): Post[] {
  const posts: Post[] = [];

  // Load published posts
  const publishedFiles = import.meta.glob('../content/published/*.md', { eager: true, query: '?raw', import: 'default' });
  for (const [path, content] of Object.entries(publishedFiles)) {
    const filename = path.split('/').pop() || '';
    const slug = getSlugFromFilename(filename);
    const fileContent = content as string;
    const { frontmatter, body } = parseFrontmatter(fileContent);
    posts.push(normalizePost(frontmatter, body, slug, 'published', fileContent));
  }

  // Load draft posts
  const draftFiles = import.meta.glob('../content/drafts/*.md', { eager: true, query: '?raw', import: 'default' });
  for (const [path, content] of Object.entries(draftFiles)) {
    const filename = path.split('/').pop() || '';
    const slug = getSlugFromFilename(filename);
    const fileContent = content as string;
    const { frontmatter, body } = parseFrontmatter(fileContent);
    posts.push(normalizePost(frontmatter, body, slug, 'drafts', fileContent));
  }

  // Sort by date descending
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}
