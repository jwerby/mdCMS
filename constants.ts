
import { Author } from './types';

export const AUTHORS: Record<string, Author> = {
  'lisa-jeff': {
    id: 'lisa-jeff',
    name: 'Lisa & Jeff',
    role: 'Founders of 1701',
    bio: 'Lisa DeNoia and Jeff Werby founded 1701, Virginia Beach\'s first coworking space, and operated it for seven years. They helped 750+ businesses and built community infrastructure for remote workers, entrepreneurs, and creatives. Lisa serves on the ViBe Creative District Board and 757 Accelerate Board.',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=150',
    socials: {
      twitter: 'https://twitter.com/arrivalvb'
    },
    postCount: 15
  }
};

export const ASSETS = [
  { name: 'arrival-logo.svg', size: '12kb', type: 'image/svg+xml' },
  { name: 'moca-building.jpg', size: '450kb', type: 'image/jpeg' },
  { name: 'vibe-district.jpg', size: '380kb', type: 'image/jpeg' },
];
