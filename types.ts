
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

export enum Page {
  HOME = 'home',
  POST = 'post',
  EDITOR = 'editor',
  DASHBOARD = 'dashboard',
  DRAFTS = 'drafts',
  ADMIN_LOGIN = 'admin_login',
  FILE_MANAGER = 'file_manager',
  DATABASE_INSIGHTS = 'db_insights',
  DOCUMENTATION = 'documentation'
}

export interface AuthState {
  isLoggedIn: boolean;
  user: string | null;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface EditorState {
  postSlug: string | null;
  content: string;
  frontmatter: Record<string, any>;
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
  frontmatter: Record<string, any>;
  date: string;
}

export interface APIImage {
  filename: string;
  url: string;
  size: number;
  markdown?: string;
}
