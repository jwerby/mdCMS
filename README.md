# arrival-mdCMS

A fast, intuitive markdown CMS with one-click publishing, live editing, and image management.

## Features

### Dashboard
- Grid view of all posts with status badges (green=published, amber=draft)
- **One-click publish/unpublish** - toggles between `content/published/` and `content/drafts/`
- Create new posts with auto-generated slugs
- Delete posts with confirmation
- Search and filter posts

### Live Editor
- Split-pane view: markdown editor + live preview
- Collapsible SEO metadata panel
- Auto-generate SEO metadata from content
- Keyboard shortcuts:
  - `Cmd+S` - Save
  - `Cmd+P` - Toggle preview
  - `Cmd+I` - Open image manager

### Image Manager
- Drag-and-drop upload
- Auto-optimizes images to WebP format (max 1200px width)
- Gallery view of all images
- Click to insert markdown into post
- Copy URL or delete images

### Markdown Rendering
- Headers (H1, H2, H3)
- **Bold**, *italic*, `inline code`
- [Links](url) with styled hover states
- Images with lazy loading and captions
- Ordered and unordered lists
- Code blocks with syntax highlighting container
- Special blocks: `> BREAKOUT:` quotes and `> CTA:` call-to-action boxes

## Architecture

```
arrival-mdCMS/
├── server/                 # Express backend (port 3114)
│   ├── index.ts           # Server entry point
│   └── routes/
│       ├── posts.ts       # CRUD + publish toggle API
│       └── images.ts      # Image upload with Sharp optimization
├── store/
│   └── index.ts           # Zustand state management
├── views/
│   ├── Dashboard.tsx      # Post management UI
│   └── Editor.tsx         # Live markdown editor
├── components/
│   ├── MarkdownRenderer.tsx  # Markdown to React
│   ├── ImageUpload.tsx       # Image manager modal
│   └── Toast.tsx             # Notifications
├── content/
│   ├── published/         # Live posts (*.md)
│   ├── drafts/            # Draft posts (*.md)
│   └── images/            # Uploaded images (*.webp)
└── App.tsx                # Main app with routing
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | List all posts |
| GET | `/api/posts/:slug` | Get single post |
| POST | `/api/posts` | Create new post |
| PUT | `/api/posts/:slug` | Update post content |
| PATCH | `/api/posts/:slug/publish` | Toggle publish status |
| DELETE | `/api/posts/:slug` | Delete post |
| GET | `/api/images` | List all images |
| POST | `/api/images` | Upload image (multipart) |
| DELETE | `/api/images/:filename` | Delete image |

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

Run both frontend and backend concurrently:

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:3113 (Vite)
- **Backend**: http://localhost:3114 (Express)

Or run separately:

```bash
npm run dev:frontend  # Vite on port 3113
npm run dev:backend   # Express on port 3114
```

### Environment Variables

Create `.env.local` with:

```
GEMINI_API_KEY=your_api_key_here
```

## Content Format

Posts are markdown files with YAML frontmatter:

```markdown
---
meta_title: Your SEO Title
meta_description: Description for search engines
primary_keyword: main keyword
secondary_keywords: keyword2, keyword3
url_slug: /blog/your-post-slug
published_date: 2025-01-15
---

# Your Post Title

Your content here...
```

## Publishing Flow

1. Create a new post from the Dashboard (saved to `content/drafts/`)
2. Edit content in the live Editor
3. Click the publish toggle to move to `content/published/`
4. Toggle back to unpublish (moves back to drafts)

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Express, TypeScript
- **State**: Zustand
- **Image Processing**: Sharp (WebP conversion, resizing)
- **File Storage**: Local filesystem (`content/` directory)

## License

MIT
