# AngrySquirrel.org Site Map

This document maps the public site, TinaCMS editing areas, and the source locations that generate them.

## 1. Public information architecture

```text
/
├── Portfolio destinations
│   ├── /portfolio/video/
│   ├── /portfolio/photography/
│   └── Journal-backed portfolio/project destinations
├── /journal/
│   ├── section views
│   ├── /archive/[slug]/
│   └── /tags/[slug]/
├── /resume/
├── /contact/
├── /about/
├── Custom Pages at explicit paths
├── /rss.xml
├── /sitemap.xml
└── /robots.txt
```

The primary navigation is owner-managed in Tina under **Settings → Site Settings**. Journal-specific navigation is intentionally kept within the Journal experience rather than duplicating every Journal category in the main site header.

## 2. Main public routes

| Public route | Purpose | Route source | Editable content source |
| --- | --- | --- | --- |
| `/` | Homepage | `src/pages/index.astro` | `src/content/pages/home.md` |
| `/journal/` | Journal landing | `src/pages/journal/` | `src/content/pages/journal.md` |
| `/archive/[slug]/` | Journal article detail | `src/pages/archive/` | `src/content/entries/*.mdx` |
| `/tags/[slug]/` | Topic archive | `src/pages/tags/` | `src/content/tags/*.md` + Journal references |
| `/about/` | About | `src/pages/about.astro` | `src/content/pages/about.md` |
| `/contact/` | Contact | `src/pages/contact.astro` | `src/content/pages/contact.md` |
| `/resume/` | Structured Resume | `src/pages/resume.astro` | `src/content/pages/resume.md` |
| custom explicit paths | Portfolio/editorial standalone pages | `src/pages/[...path].astro` | `src/content/flexible-pages/` |
| `/rss.xml` | Journal feed | `src/pages/rss.xml.ts` | published Journal entries |
| `/sitemap.xml` | Search-engine sitemap | `src/pages/sitemap.xml.ts` | generated from public content/routes |
| `/robots.txt` | crawler instructions | `src/pages/robots.txt.ts` | route implementation |
| `/deployment.json` | live deployment commit metadata | `src/pages/deployment.json.ts` | build/runtime metadata |
| `/404` | not-found page | `src/pages/404.astro` | route implementation |

## 3. Current Custom Page hierarchy

Custom Pages are routed by their explicit `path` field, not by their physical folder alone.

Current portfolio files include:

```text
src/content/flexible-pages/portfolio/
├── video.md
└── photography.md
```

These correspond to the dedicated Video and Photography portfolio destinations. Other portfolio-style destinations may intentionally point into Journal content rather than requiring a separate Portfolio collection.

A `journal/` organizational folder also exists under `src/content/flexible-pages/`; inspect each document's explicit `path` before assuming its public URL.

## 4. TinaCMS map

```text
/admin/
├── Settings
│   ├── Site Settings
│   ├── Topics
│   └── Publish Site
├── Pages
│   ├── Main Homepage
│   ├── Journal Homepage
│   ├── About
│   ├── Contact
│   ├── Resume
│   └── Custom Pages
├── Content
│   ├── Journal
│   ├── Journal Sections
│   └── Import
└── Media
    └── Media Manager
```

### Settings → Site Settings

Backed primarily by:

`src/content/settings/site.md`

Controls site-level editable information such as site identity, primary navigation, nested navigation, footer content/links, and copyright name.

### Settings → Topics

Backed by:

`src/content/tags/*.md`

Owner-facing name: **Topics**.

Public route: `/tags/[slug]/`.

### Settings → Publish Site

Uses:

- `functions/admin/api/publish.js`
- `src/pages/deployment.json.ts`
- Cloudflare Access
- Cloudflare deploy hook
- `PUBLISH_STATE` KV binding

### Pages

Fixed page content:

```text
src/content/pages/
├── home.md
├── journal.md
├── about.md
├── contact.md
└── resume.md
```

Custom Pages:

`src/content/flexible-pages/`

### Content → Journal

Stored in:

`src/content/entries/*.mdx`

Each entry may generate a public `/archive/[slug]/` route when Published.

### Content → Journal Sections

Stored in:

`src/content/journal-sections/*.md`

Sections control Journal classification/navigation and may support stable slugs/aliases and Active/Retired state.

### Content → Import

Import UI/configuration is implemented through Tina custom components and the current Entries mutation/schema. Imported output is written into `src/content/entries/` as a Draft.

### Media → Media Manager

Handles repository-managed uploads. The separate Immich picker is integrated into supported structured image fields and Markdown/import workflows.

## 5. Rendering map

```text
src/content/*
   ↓ validated by
src/content.config.ts
   ↓ queried/rendered by
src/pages/* + src/layouts/* + src/components/*
   ↓ styled by
src/styles/* + component-scoped styles
   ↓ built by Astro
Cloudflare Pages
```

Tina overlays an editing schema on the same durable content:

```text
src/content/*
   ↕
tina/config.ts + tina/components/*
   ↕
TinaCloud /admin/
```

The Tina schema and Astro validation must remain synchronized.

## 6. Media map

### Repository-managed media

```text
Tina Media Manager
→ repository-managed upload path
→ content references /uploads/...
→ Astro/Cloudflare serves the asset
```

### Immich single-image workflow

```text
Tina editor
→ Choose from Immich / Immich image
→ /admin/api/media/*
→ Cloudflare Access validation
→ private Immich via Tunnel
→ Immich thumbnail/preview
→ R2 MEDIA_BUCKET
→ https://media.angrysquirrel.org/...
→ permanent URL stored in content
```

Relevant source:

- `functions/admin/api/media/`
- `src/server/media-backend.js`
- shared Tina picker/components under `tina/components/`

### Galleries

The existing gallery path is distinct from the single-image R2 publication flow. Gallery architecture/security remains active roadmap work; see `Roadmap.md`.

## 7. Styling map

```text
src/styles/global.css
├── imports variables.css
├── imports typography.css
└── imports utilities.css
```

### `src/styles/variables.css`

Global design tokens:

- colors
- font-family variables
- content/read widths
- line height
- spacing
- radius
- shadows

### `src/styles/typography.css`

Typography sizing, hierarchy, editorial text behavior, and related rules.

### `src/styles/utilities.css`

Reusable layout/helper classes.

### Component scoped styles

Local component appearance may live directly in `.astro` component files under `src/components/`, `src/layouts/`, or route files.

## 8. Infrastructure map

```text
GitHub: HammerheadFistpunch/GTP_Port:gpt-handoff
  │
  ├── TinaCloud reads/writes content
  │
  └── deliberate Cloudflare Pages deployment
        │
        ├── public site: angrysquirrel.org
        ├── protected admin: /admin/
        ├── protected admin Functions
        │    ├── publish relay
        │    └── media backend
        └── public R2 media: media.angrysquirrel.org

Home Immich
  → outbound Cloudflare Tunnel
  → private Access-protected origin
  → media backend only
```

Visitor-facing/public Immich share/gallery host behavior is separate from the protected server-to-server media origin and should not be treated as equivalent security boundaries.

## 9. Content ownership map

| Content | Owner-editable in Tina? | Durable location |
| --- | ---: | --- |
| Homepage content | yes | `src/content/pages/home.md` |
| Journal landing | yes | `src/content/pages/journal.md` |
| About | yes | `src/content/pages/about.md` |
| Contact | yes | `src/content/pages/contact.md` |
| Resume | yes | `src/content/pages/resume.md` |
| Journal entries | yes | `src/content/entries/` |
| Journal Sections | yes | `src/content/journal-sections/` |
| Topics | yes | `src/content/tags/` |
| Custom Pages | yes | `src/content/flexible-pages/` |
| Navigation/footer/site identity | yes | `src/content/settings/site.md` |
| Global colors/fonts | code change | `src/styles/variables.css` |
| Typography rules | code change | `src/styles/typography.css` |
| Header/layout rendering | code change | `src/components/`, `src/layouts/`, route consumers |
| Routes | code change | `src/pages/` |
| Tina fields/navigation | code change | `tina/config.ts` |
| Tina custom controls | code change | `tina/components/` |
| Cloudflare publish API | code/infrastructure | `functions/admin/api/publish.js` + Cloudflare config |
| Immich/R2 API | code/infrastructure | `functions/admin/api/media/`, `src/server/media-backend.js`, Cloudflare config |

## 10. Documentation map

Only these durable project documents are intended to remain active:

- `README.md` — overview and quick start
- `HELP.md` — owner guide/how-to/reference
- `Roadmap.md` — current direction and planned work
- `SITE_MAINTENANCE_GUIDE.md` — technical maintenance/operations
- `SITE_MAP.md` — this architecture and information map

Use Git history for superseded implementation notes and sprint history.

## Journal comments

- Journal article pages include a reader-initiated moderated discussion.
- `/api/comments` lists approved comments and accepts pending guest submissions.
- `/comment-articles.json` lists published entries eligible for comments.
- `/admin/api/comments` supports owner-only moderation through **Content → Comments**.
- Setup and data/privacy boundaries: `COMMENTS_SETUP.md`.
