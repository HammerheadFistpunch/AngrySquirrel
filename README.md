# AngrySquirrel.org

This repository contains the source for **AngrySquirrel.org**, a personal portfolio and editorial Journal built with Astro, TinaCMS, GitHub, Cloudflare Pages, Cloudflare Access, Immich, and Cloudflare R2.

The project is intentionally content-portable: TinaCMS is the editing interface, but the durable source of truth is Markdown/MDX and structured content stored in this repository.

> Branch migration is prepared. Cloudflare/Tina still use the previous setup until the cutover in [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md) is completed.

## What the site does

- Professional portfolio for video, photography, case studies, software/projects, and related work
- Editorial Journal with sections, Topics, archives, related stories, RSS, and sitemap output
- Structured Resume, About, Contact, Homepage, and Journal landing pages
- Custom Pages for standalone or nested portfolio/editorial destinations
- TinaCMS authoring at `/admin/`
- Tina-managed global Appearance controls for typography, font sizes, layout widths, colors, spacing, and corner radii
- Deliberate publishing: Tina saves to Git first; production is published separately
- Private Immich browsing from Tina with permanent public website copies stored in Cloudflare R2
- Git-backed Markdown/MDX import, including body-only Google Docs Markdown exports

## Technology overview

```text
Owner / editor
  → TinaCloud at /admin/
  → saves content to GitHub main
  → Publish Site triggers Cloudflare Pages

Private media workflow
  → Tina image picker
  → Access-protected Pages Function
  → Cloudflare Tunnel
  → private Immich
  → selected web variants copied to R2
  → media.angrysquirrel.org

Public visitors
  → angrysquirrel.org on Cloudflare Pages
  → static Astro pages + R2 media
```

### Core services

| Service | Purpose |
| --- | --- |
| GitHub | Durable source, content history, deployment branch |
| Astro | Static site generation and public routing |
| TinaCMS / TinaCloud | Owner-facing content and appearance editor |
| Cloudflare Pages | Production hosting and Pages Functions |
| Cloudflare Access | Protects `/admin/` and private admin APIs |
| Cloudflare Tunnel | Private server-to-server path to Immich |
| Immich | Source photo library |
| Cloudflare R2 | Durable public website image copies |

## Source of truth

- Repository: `HammerheadFistpunch/AngrySquirrel`
- Production/content branch: `main`
- Feature testing branch: `development`
- Release and preview setup: [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md)
- Journal entries: `src/content/entries/`
- Topics: `src/content/tags/`
- Journal Sections: `src/content/journal-sections/`
- Fixed page content: `src/content/pages/`
- Custom Pages: `src/content/flexible-pages/`
- Navigation/footer/site settings: `src/content/settings/site.md`
- Global appearance settings: `src/data/appearance.json`
- Tina schema/editor configuration: `tina/config.ts` and `tina/components/`
- Astro content validation: `src/content.config.ts`
- Public routes: `src/pages/`
- Shared layouts/components: `src/layouts/`, `src/components/`
- Global styling rules/defaults: `src/styles/`

TinaCloud is an editor. GitHub content is the durable source of truth.

## Basic owner workflow

### Edit existing content

1. Open `https://angrysquirrel.org/admin/` and authenticate through Cloudflare Access/TinaCloud.
2. Choose the appropriate area:
   - **Settings** — Site Settings, Appearance, Topics
   - **Pages** — Homepage, Journal Homepage, About, Contact, Resume, Custom Pages
   - **Content** — Journal, Journal Sections, Import, Publish Site
   - **Media** — Media Manager
3. Edit and save. Tina commits the saved content to `main`.
4. Continue editing as needed. Saving does **not** intentionally publish production.
5. When the editing session is ready, open **Content → Publish Site**.
6. Publish once, then review the live site.

### Change fonts, sizes, colors, or spacing

Open **Settings → Appearance**. The editable values are global design tokens rather than arbitrary CSS, so normal visual changes do not require code edits. The initial defaults reproduce the existing site design.

Appearance currently exposes UI/editorial font choices, body and article font size, heading scale, line height, maximum site/reading widths, the core color palette, spacing scale, and corner radii.

### Create a Journal entry

1. Open **Content → Journal** and create an entry.
2. Add the title and body first.
3. Choose a Journal Section, status, and Topics.
4. Add description, date, cover image, and optional gallery.
5. Keep unfinished work **Draft**.
6. Change it to **Published**, save, then use **Publish Site** when the site should rebuild.

Published entries use durable URLs under `/archive/[slug]/`. Draft entries remain in Git/Tina but do not receive a public article route.

### Add images

For most website images, use **Choose from Immich** or **Immich image** in the Markdown toolbar. Tina browses the private Immich library, then publishes/reuses a permanent website copy on `media.angrysquirrel.org`.

Repository-managed uploads and safe external HTTPS image URLs are also supported.

### Import an article

Open **Content → Import** and upload/paste Markdown or MDX. YAML frontmatter is optional. Body-only Google Docs Markdown exports are supported. Review the mapping, choose metadata/Topics, and create the imported draft. Full instructions are in `HELP.md`.

## Local development

Requires Node **22.22.0+ on the 22.x line, or 24.x** (the Node majors supported by the Tina CLI).

```bash
npm install
npm run dev
```

Useful validation commands:

```bash
npm run test:authoring
npx tsc --noEmit
npm run build
```

For Astro-only work without TinaCloud credentials:

```bash
npm run build:astro
```

## Important schema rule

A Tina/content schema change is not complete until all affected layers agree:

1. `tina/config.ts`
2. `src/content.config.ts` when an Astro content collection changes
3. stored content/data
4. route/layout/component consumers
5. generated `tina/tina-lock.json`
6. TinaCloud indexing/editor behavior
7. production build

Never hand-edit `tina/tina-lock.json`.

## Documentation

This repository deliberately keeps documentation small and durable:

- **`README.md`** — project overview and basic owner workflow
- **`HELP.md`** — complete owner help, editing/import/media/how-to guides, and customization locations
- **`Roadmap.md`** — current status, priorities, and future work
- **`SITE_MAINTENANCE_GUIDE.md`** — developer/operations maintenance, deployment, security, recovery, and validation
- **`SITE_MAP.md`** — public information architecture, route map, Tina map, and source map

Historical sprint logs, temporary audits, implementation notes, and superseded guides are intentionally not retained as active documentation; Git history remains available when historical detail is needed.

## Journal comments

Name-only guest comments are moderated under **Content → Comments**. Only approved comments are public. [COMMENTS_SETUP.md](COMMENTS_SETUP.md) covers the one-time Cloudflare D1/Turnstile setup required to activate the feature.
