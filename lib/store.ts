import { create } from 'zustand';
import type { Toast, Post, APIPost } from './types';

// SEO Research store - transfers research data to write page
interface ResearchData {
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  targetWordCount: number;
  rawContent: string;
  outline: string[];
}

interface SEOResearchState {
  researchData: ResearchData | null;
  setResearchData: (data: ResearchData) => void;
  clearResearchData: () => void;
}

export const useSEOResearchStore = create<SEOResearchState>((set) => ({
  researchData: null,
  setResearchData: (data) => set({ researchData: data }),
  clearResearchData: () => set({ researchData: null }),
}));

// Toast store - minimal, just for UI notifications
interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    set(state => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    // Auto-remove after 3 seconds
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  }
}));

// Convert API post to app Post format
export function apiToPost(apiPost: APIPost): Post {
  const frontmatter = apiPost.frontmatter as Record<string, string | string[]>;
  const tags: string[] = [];

  const secondaryKeywords = frontmatter.secondary_keywords;
  if (secondaryKeywords) {
    if (Array.isArray(secondaryKeywords)) {
      tags.push(...secondaryKeywords);
    } else if (typeof secondaryKeywords === 'string') {
      tags.push(...secondaryKeywords.split(',').map(s => s.trim()));
    }
  }

  const primaryKeyword = frontmatter.primary_keyword || frontmatter['Primary Keyword'];
  if (typeof primaryKeyword === 'string' && !tags.includes(primaryKeyword)) {
    tags.unshift(primaryKeyword);
  }

  return {
    slug: apiPost.slug,
    title: apiPost.title,
    description: apiPost.description,
    date: apiPost.date,
    authorId: 'lisa-jeff',
    author: 'Lisa & Jeff',
    category: typeof primaryKeyword === 'string' ? primaryKeyword.split(' ')[0] || 'Community' : 'Community',
    thumbnail: (frontmatter.thumbnail as string) || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
    content: apiPost.content,
    directory: apiPost.directory,
    tags,
    size: `${(new Blob([apiPost.content]).size / 1024).toFixed(1)}kb`,
    views: 0,
    likes: 0
  };
}
