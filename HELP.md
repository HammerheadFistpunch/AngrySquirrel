# AngrySquirrel.org Help Guide

This is the owner-facing reference for editing, importing, publishing, media, appearance, and common site changes.

## 1. TinaCMS navigation

Open `https://angrysquirrel.org/admin/`.

Current owner navigation:

- **Settings**
  - Site Settings
  - Appearance
  - Topics
  - Publish Site
- **Pages**
  - Main Homepage
  - Journal Homepage
  - About
  - Contact
  - Resume
  - Custom Pages
- **Content**
  - Journal
  - Journal Sections
  - Import
- **Media**
  - Media Manager

## 2. Editing and publishing basics

Tina saves to GitHub first. Saving content is intentionally separate from publishing the production site.

Normal workflow:

1. Edit content in Tina.
2. Save as often as needed.
3. Keep unfinished Journal entries or Custom Pages in **Draft**.
4. When the editing session is ready, open **Settings → Publish Site**.
5. If Saved and Live differ, publish once.
6. Review the deployed site after the saved commit is reported live.

If Saved and Live match, there is nothing new to publish.

## 3. Journal entries

Every item under **Content → Journal** uses the same Journal model.

Main fields:

- Title
- Markdown body
- Journal Section
- Status: Draft or Published
- Topics
- Description
- Publication Date
- Cover Image
- optional Immich Gallery

### Recommended authoring order

1. Write the title.
2. Write or paste the body.
3. Choose the Journal Section.
4. Set Draft/Published status.
5. Choose Topics.
6. Add description/date/cover/gallery as needed.
7. Save.
8. Publish the site only when the full editing session is ready.

Journal detail URLs are `/archive/[slug]/`.

### Draft behavior

Draft content remains stored in Tina/GitHub but should not receive a public article route after the next successful production build.

If a previously published article is changed back to Draft, save it and deliberately publish the site so the public build is regenerated without that route.

## 4. Journal Sections vs Topics

Use **Journal Section** for where the story belongs. Use **Topics** for what the story is about.

### Journal Sections

Managed at **Content → Journal Sections**.

A section has:

- name
- permanent slug
- description
- Active/Retired state
- previous slugs/aliases

Guidance:

- Rename the visible name freely.
- Treat the slug as durable.
- Retire old sections rather than removing historical meaning.
- Use previous slugs when intentionally migrating a section URL.

### Topics

Managed at **Settings → Topics**.

A Topic has:

- Topic Name
- description
- Active/Retired state
- optional Replacement Topic
- permanent slug
- previous slugs

Guidance:

- Add a Topic for a reusable subject, not every one-off phrase.
- Rename the visible Topic Name freely.
- Keep the permanent slug stable unless intentionally changing the public URL.
- Retire rather than delete when old stories still use a Topic.
- Use Replacement Topic only when two Topics are deliberately consolidated.

The underlying collection is still named `tags` and public Topic pages remain `/tags/[slug]/` for compatibility.

## Featured Journal story

Set **Featured Journal Story** under **Content → Journal Homepage** once. Both the main homepage preview and Journal homepage use this selection. Leave it blank to feature the newest published story. Draft or missing selections also fall back to the newest published story; no published stories means no featured tile. The main homepage's Journal Preview Section controls presentation and recent-story count only.

## Pinned Journal posts

Open **Content → Journal**, edit a post, and turn on **Pin in Journal**. You can pin any number of posts. Save, then use **Settings → Publish Site** to make the changes live.

Pinned published posts appear above unpinned posts on the Journal page and within their Journal Section, with newest first in each group. Cards show a **Pinned** label. Turn the checkbox off to return a post to its normal date order. Drafts remain private. The featured story stays separate at the top of the Journal page and is not repeated in the list; pinning does not change the homepage preview.

## Journal comments

Readers can leave a name and plain-text comment without an account or email. Comments stay private until you approve them under **Content → Comments**. Readers can use **Reply** beneath approved comments; replies appear one level beneath their parent and also need approval. The moderation screen shows the original comment for context. That screen also lets you reject/hide or permanently delete comments. Hiding a parent hides its replies; deleting a parent deletes its replies. Approval is live; no Publish Site action is needed for moderation.

To hide discussion on a particular article, turn on **Disable Comments**, save, and publish. Commenting requires the one-time Cloudflare setup in [COMMENTS_SETUP.md](COMMENTS_SETUP.md).

## 5. Markdown editor

Journal bodies and supported page body fields use a Markdown-first editor.

The source uses 16px text; the sanitized preview uses 18px text with compact headings. Preview formatting includes visible list markers, nested lists, bold/italic/strikethrough, blockquotes, tables, and code. Numbered-list starting values and table alignment are preserved; executable HTML and arbitrary styles remain filtered.

The toolbar supports:

- bold
- italic
- strikethrough
- inline code
- bulleted lists
- numbered lists
- links
- Media Manager images
- Immich/R2 images
- external HTTPS images
- YouTube

Desktop provides Write/Split/Preview. Mobile uses Write/Preview to avoid an unusable split view.

Use standard Markdown whenever possible.

### YouTube

The supported inline MDX form is:

```mdx
<YouTube url="https://www.youtube.com/watch?v=VIDEO_ID" title="Descriptive title" caption="Optional caption" />
```

Do not add arbitrary custom components or executable MDX to normal content.

## 6. Images and media

There are three normal image sources.

### A. Choose from Immich — preferred for photo-library images

Use **Choose from Immich** on structured image fields or **Immich image** in the Markdown toolbar.

Workflow:

1. Open the picker.
2. Search or browse albums.
3. Select an image.
4. The protected backend asks Immich for website-size variants.
5. The selected variants are copied/reused in Cloudflare R2.
6. Tina stores only the permanent public `media.angrysquirrel.org` URL.

This means a normal page image continues to work even if the home Immich server is temporarily offline.

### B. Media Manager

Use **Media Manager** for repository-managed uploads when appropriate. These normally use `/uploads/...` paths.

### C. External image URL

Safe public HTTPS image URLs are supported where exposed. Avoid credential-bearing URLs, temporary signed URLs, or private hosts.

### Image quality and dimensions for Immich → R2

The backend currently copies Immich-generated `thumbnail` and larger preview variants rather than processing originals itself. Therefore, the dimensions/quality of newly published website images are controlled primarily by **Immich's image/thumbnail settings**.

If the image-generation recipe changes materially, update `MEDIA_VARIANT_VERSION` in Cloudflare so newly selected images receive new immutable R2 URLs rather than colliding with older cached variants.

Existing R2 images are intentionally not overwritten.

## 7. Immich galleries

Gallery content currently uses the site's gallery integration rather than the single-image R2 publication path. Gallery architecture/privacy is the next major roadmap area.

Until that work is completed:

- do not expose private Immich API keys anywhere in content
- do not paste private origin URLs into public pages
- use the existing supported gallery fields/blocks only
- treat public share URLs/tokens as sensitive publication data

See `Roadmap.md` for the planned gallery hardening work.

## 8. Import guide

Use **Content → Import** to turn Markdown/MDX into a normal Journal draft.

### Supported input

- `.md`
- supported `.mdx`
- pasted Markdown/MDX source
- body-only Google Docs Markdown exports
- Markdown with YAML frontmatter

Frontmatter is optional. The importer generates canonical Tina frontmatter after review.

### Recommended Google Docs workflow

1. Export or convert the Google Doc to Markdown.
2. Do **not** manually add YAML just to satisfy the importer.
3. Open **Content → Import**.
4. Upload the `.md` file or paste the Markdown source.
5. Choose **Review Import**.
6. Confirm the full document body appears in the body field.
7. Review/edit the derived filename and title.
8. Add description, Journal Section, Topics, date, and cover as needed.
9. Choose **Create imported draft**.
10. Review the created entry in the normal Journal editor.
11. Publish it only when ready.

The importer always creates a Draft and should never overwrite an existing filename.

### Frontmatter mapping

When frontmatter exists, common keys map as follows:

| Site field | Accepted source keys |
| --- | --- |
| Title | `title` |
| Description | `description`, `summary`, `excerpt` |
| Publication date | `date`, `publishedDate`, `published_at` |
| Journal Section | `journalSection`, `section` |
| Topics | YAML list, comma-separated values, existing references |
| Cover image | `coverImage`, `cover`, `image`, `featured_image` |

Older deprecated metadata may be recognized for review but is not part of the current Journal model.

### Topic matching during import

The review screen should show active Topics as selectable choices. It can also resolve existing Topic labels/slugs/references.

If a Topic does not exist, create it under **Settings → Topics** before completing the imported draft.

### Import safety rules

Ordinary Markdown is supported, including headings, paragraphs, lists, blockquotes, tables, code fences, links, and images.

The importer rejects unsafe or unsupported content such as:

- malformed frontmatter
- empty bodies
- unsafe image/link destinations
- credential-bearing URLs
- executable MDX expressions
- `import` / `export` statements
- unsupported custom MDX components
- malformed YouTube components

The body should remain portable Markdown/MDX after import.

## 9. Fixed pages

Fixed editable page content lives in Tina under **Pages**.

- Main Homepage
- Journal Homepage
- About
- Contact
- Resume

### Homepage

The Homepage is intentionally structured rather than a completely free-form page builder. Use Tina to edit its section content, visibility, order, Journal feature/recent count, and portfolio destinations.

### Resume

The Resume is one structured source. Update the Resume through Tina rather than maintaining a separate second dataset. Any future generated PDF should consume this same source.

## 10. Custom Pages

Custom Pages support standalone and nested content using an explicit **URL Path**.

Supported blocks include:

- Rich Text
- Image
- YouTube Video
- Immich Gallery
- Child Page Tiles
- Call to Action

Important routing rule: changing a page title does not change its URL; changing its `path` does. Established public paths should receive a redirect before they are changed.

Physical folders under `src/content/flexible-pages/` are for editorial organization. The explicit `path` field controls the public route.

## 11. Navigation, header, footer, and site identity

Most owner-editable header/footer navigation lives in:

`src/content/settings/site.md`

Use **Settings → Site Settings** in Tina for normal changes such as:

- site name / logo text
- default description
- primary navigation
- nested navigation
- footer links/text
- copyright name

If a change is not exposed there, the presentation logic is in Astro components/layouts rather than content.

## 12. Appearance: fonts, sizes, colors, spacing, and widths

For normal site-wide visual changes, use **Settings → Appearance** in Tina. You no longer need to edit CSS for the common design controls listed below.

The stored Appearance data lives at:

`src/data/appearance.json`

### Typography controls

- **UI Font** — navigation, buttons, labels, and interface text
- **Editorial Font** — headings and editorial display type
- **Body Font Size** — base site text size in pixels
- **Article Font Size** — long-form Journal paragraph size in pixels
- **Heading Scale** — global multiplier for heading sizes; `1.0` preserves the original scale
- **Line Height** — global text line-height multiplier

Supported UI fonts are Lato, Inter, Source Sans 3, and the system sans-serif stack. Supported editorial fonts are Newsreader, Merriweather, Source Serif 4, and Georgia.

### Layout controls

- **Maximum Site Width** — shared `.container` width
- **Reading Column Width** — long-form `.reading-width` and article width

A few component-specific layouts may intentionally impose their own narrower constraints; Appearance controls the shared design system rather than overriding every local layout decision.

### Color controls

- Page Background
- Surface Background
- Elevated Surface
- Primary Text
- Secondary Text
- Accent Color

Use CSS color values; hex colors such as `#4F91C7` are recommended.

### Shape and spacing controls

- Small / Medium Corner Radius
- Small / Medium / Large / Extra Large Spacing

These feed the shared CSS variables used by cards, sections, utilities, and other components.

### Safe adjustment ranges

The editor descriptions provide recommended ranges. For small experiments, change one or two values at a time, save, deliberately publish, and review desktop and mobile. The committed default values reproduce the pre-Appearance design.

### What still requires code

Appearance intentionally does **not** expose arbitrary CSS, per-page margins, custom class names, animation rules, or every component-specific measurement. Those remain code-controlled to prevent accidental layout breakage.

The implementation lives in:

- `src/data/appearance.json` — Tina-edited values
- `src/layouts/BaseLayout.astro` — converts values into global CSS custom properties
- `src/styles/variables.css` — fallback/default design tokens
- `src/styles/typography.css` — typography rules and supported web-font loading
- `src/styles/utilities.css` — shared container/spacing helpers
- `tina/config.ts` — Appearance editor fields

## 13. Where code changes live

| What you want to change | Main location |
| --- | --- |
| Site content | `src/content/` via Tina |
| Nav/footer/site settings | `src/content/settings/site.md` |
| Normal global visual settings | **Settings → Appearance** / `src/data/appearance.json` |
| CSS token fallbacks | `src/styles/variables.css` |
| Typography rules/font loading | `src/styles/typography.css` |
| Global CSS behavior | `src/styles/global.css` |
| Reusable UI | `src/components/` |
| Shared page/entry layouts | `src/layouts/` |
| Public routes | `src/pages/` |
| Tina collections/fields | `tina/config.ts` |
| Custom Tina controls/editor | `tina/components/` |
| Astro content validation | `src/content.config.ts` |
| Publishing API | `functions/admin/api/publish.js` |
| Media APIs | `functions/admin/api/media/` |
| Immich/R2 server logic | `src/server/media-backend.js` |

For a full technical repository and route map, see `SITE_MAP.md`. For safe maintenance procedures, see `SITE_MAINTENANCE_GUIDE.md`.

## 14. Common recovery situations

### A save succeeded but the live site did not change

This is normally expected. Open **Settings → Publish Site** and compare Saved vs Live. Production only changes after a deliberate publish.

### A build failed

The previous working Cloudflare deployment should remain live. Read the first useful build error, fix the content/source issue on `gpt-handoff`, save/push the correction, then publish again.

### Tina reports a schema mismatch

Do not assume reindexing alone will fix it. Verify that `tina/config.ts`, stored content/data, renderers, and `tina/tina-lock.json` all describe the same model. If an Astro content collection changed, also verify `src/content.config.ts`. Regenerate the lock through Tina tooling, then reindex TinaCloud.

### An Appearance change looks wrong

Restore the affected value in **Settings → Appearance** and save again. Because Appearance is Git-backed, previous values are also recoverable from Git history. If the editor itself is unavailable after an Appearance schema change, restore `src/data/appearance.json` and verify the Tina schema/lock before reindexing.

### An old URL needs to move

Add a redirect first, then change the public route/path. Do not silently break established URLs.

### An R2 image is no longer needed

Do not delete it casually. Search the repository first because old revisions are intentionally immutable and existing Markdown may still reference them.

