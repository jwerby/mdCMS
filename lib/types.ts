export type Directory = 'published' | 'drafts' | 'images';

export interface Author {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatar: string;
  socials?: {
    twitter?: string;
    github?: string;
  };
  postCount?: number;
}

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  authorId: string;
  author: string;
  category: string;
  thumbnail: string;
  content: string;
  directory: Directory;
  tags: string[];
  size?: string;
  views: number;
  likes: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface EditorState {
  postSlug: string | null;
  content: string;
  frontmatter: Record<string, unknown>;
  isDirty: boolean;
  isSaving: boolean;
}

// API response types
export interface APIPost {
  slug: string;
  filename: string;
  title: string;
  description: string;
  directory: 'published' | 'drafts';
  content: string;
  frontmatter: Record<string, unknown>;
  date: string;
}

export interface APIImage {
  filename: string;
  url: string;
  size: number;
  markdown?: string;
}

// SEO Machine types
export interface ResearchBrief {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  targetAudience: string;
  competitorUrls: string[];
  outline: string[];
  createdAt: string;
}

export interface ContentScore {
  overall: number;
  readability: number;
  seo: number;
  engagement: number;
  originality: number;
  issues: string[];
  suggestions: string[];
}

export interface PerformanceData {
  pageViews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  clicks: number;
  impressions: number;
  avgPosition: number;
}
