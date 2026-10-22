# GTP_Port Roadmap

Last updated: 2026-10-22

## Product direction

AngrySquirrel.org is intended to remain a fast, low-maintenance personal site with two equally important jobs:

1. present professional portfolio/resume material clearly; and
2. support long-form editorial publishing without locking content into a proprietary CMS.

The durable architecture is Astro + Git-backed Markdown/MDX + TinaCMS, deployed on Cloudflare. Immich remains the private source media library while selected website assets are copied to R2 for public delivery.

## Current state

### Mobile Field Notes (2026-10-22)

- Added **Content → Quick Field Note**, a focused mobile composer using the existing Tina login and Journal schema.
- Plain-text notes receive automatic title, summary, date, and Field Notes section; optional native photo uploads are resized before storage.
- Browser backup protects unfinished notes; save retries retain the same document identity.
- Publish saves and requests the existing site build; Save Draft stays unpublished. Build failures retain the saved entry and offer publishing retry.
- No schema changes or new service credentials are required.

The core platform is operational:

- Astro 6 static site on Cloudflare Pages
- TinaCloud owner editing at `/admin/`
- deliberate **Publish Site** workflow rather than automatic production builds on every save
- unified Journal content model with Draft/Published status
- Tina-managed Journal Sections and Topics
- durable `/archive/[slug]/` Journal detail URLs and `/tags/[slug]/` Topic archives
- structured Homepage, Journal landing page, Resume, About, and Contact content
- Custom Pages with constrained reusable blocks
- Markdown-first authoring for Journal and page body content
- Markdown/MDX import including body-only Google Docs exports
- private Immich browsing/search/album access from Tina
- permanent R2 publication for selected website images
- responsive Immich picker and common structured-image integration
- RSS, sitemap, robots, canonical, Open Graph, and Twitter metadata

## Latest editor and article title fixes (2026-10-14)

- Reduced article titles to a responsive 32–48px scale and tightened article header spacing so long titles do not dominate the first screen.
- Increased Markdown source and preview text sizes and reduced preview heading scale.
- Restored explicit Markdown typography in the sanitized preview so Tina resets do not hide list markers or emphasis.
- Preserved safe ordered-list starts and table alignment during sanitization.

## Shared featured story (2026-10-14)

Journal Homepage owns the featured-story selection for both `/` and `/journal/`. Removed the duplicate main-homepage field and content value. Both surfaces resolve Tina references consistently and fall back to the newest published story when the selection is empty, missing, or a draft.

## Multiple pinned Journal posts (2026-10-21)

Journal entries now expose **Pin in Journal**. Any number of published posts can stay above unpinned entries on the Journal landing page and within their Section, newest first in each group, with a Pinned label. Featured-story selection and homepage recency remain independent.

## Active priorities

### 1. Page-header simplification and homepage identity

**Status: next UI/content cleanup.**

The current page-header model exposes too many required text layers at once: page title, eyebrow, headline, and description. This creates redundant copy and visually crowded headers.

Planned changes:

- add the site logo to the main/homepage header
- simplify the shared page-header content model
- stop requiring all of page title, eyebrow, headline, and description simultaneously
- prefer a required primary title/headline with optional supporting fields
- make Astro components adapt cleanly when optional header fields are omitted
- update Tina schema/editor labels so authors are not forced to invent redundant copy

Acceptance goals:

- homepage header clearly carries the site identity/logo
- ordinary pages can render a clean header with only the content they actually need
- existing content remains compatible or receives a safe migration
- header cleanup reduces visual clutter without changing the established typography/color system

### 2. SEO and analytics optimization

**Status: ready for audit and implementation after header cleanup.**

The site already has RSS, sitemap, robots, canonical, Open Graph, and Twitter metadata. The next phase should verify and strengthen the complete search/discovery layer rather than assuming those pieces are sufficient.

SEO audit scope:

- page titles and meta descriptions
- canonical URL consistency
- Open Graph/social metadata
- structured data/schema markup where useful
- sitemap and robots behavior
- image alt text and media metadata
- internal linking and Journal/Topic/Section relationships
- indexability of Draft versus Published content
- SEO field design in Tina, avoiding unnecessary editor clutter

Analytics scope:

- establish a privacy-conscious baseline, with Cloudflare Web Analytics as the first option to evaluate
- measure pageviews and useful engagement rather than collecting data without a decision purpose
- consider event tracking for outbound links, portfolio interactions, galleries/media, contact actions, downloads, and Journal engagement
- document privacy implications before introducing any third-party analytics service

Acceptance goals:

- important public pages have intentional titles/descriptions/canonicals
- structured metadata validates where implemented
- Draft content is not indexed or exposed through public discovery surfaces
- analytics can answer useful site/product questions with minimal tracking burden
- no paid analytics dependency is required for baseline operation

### 3. Journal comments/community layer

**Status: comments activated and smoke-tested; one-level replies implemented, pending migration and deployment.**

Selected native Pages Functions + D1 + Turnstile after comparing GitHub-backed, hosted guest, and native options. Readers enter a name without an account or email. Comments support one level of replies beneath approved parents. Replies use the same moderation queue, remain private until approval, and disappear publicly when their parent is hidden. Every comment waits for approval in **Content → Comments**; only approved comments are public. Approval, hiding, and deletion work without a site rebuild. Per-entry Disable Comments, published-article eligibility, same-origin checks, payload limits, Turnstile verification, and database rate limits are included.

See `COMMENTS_SETUP.md` for the comparison, production bindings/secrets, migration, moderation/privacy policy, backup steps, and live acceptance test. Replies require migration `0002_comment_replies.sql` before deployment; the existing D1/Turnstile configuration is reused. Articles remain readable if commenting fails.

### 4. Gallery architecture and privacy

**Status: major feature area.**

The current Immich Gallery block still depends on live gallery/share behavior. Replace or harden it so public gallery pages do not expose long-lived Immich share tokens or reveal the home origin.

Evaluate:

- R2-mirrored gallery manifests/assets
- a restricted Cloudflare Worker/Pages Function gallery facade
- a deliberate hybrid where gallery metadata is live but public images remain edge-hosted

Acceptance goals:

- no private Immich API credentials in browser content
- no residential/home origin disclosure
- graceful behavior if Immich is offline
- gallery authoring remains practical in Tina
- existing gallery content has a migration path

### 5. Immich picker polish

**Status: follow-up refinement.**

Known UX work:

- use infinite scrolling instead of manual **Load more** in image and gallery pickers
- continue verifying album browsing against large libraries
- preserve full-screen/touch-friendly mobile behavior
- keep Markdown and preview panes usable at narrow and desktop widths

### 6. Authoring/editor hardening

Continue simplifying Tina around the owner's workflow rather than exposing implementation details.

Priorities:

- confirm all Draft → Published → Draft transitions correctly remove/add public routes after a deliberate publish
- ensure Topics/Journal Sections can be created safely without breaking TinaCloud schema/indexing or production builds
- add clearer recovery behavior for invalid content references
- retain body portability and sanitized preview behavior

### 7. Documentation as maintained product surface

The repository now has five durable documentation files only:

- `README.md`
- `HELP.md`
- `Roadmap.md`
- `SITE_MAINTENANCE_GUIDE.md`
- `SITE_MAP.md`

Update these when behavior changes. Do not recreate sprint diaries, temporary audit documents, or duplicate feature guides unless there is a specific short-lived engineering need; use issues/commits for implementation history.

## Planned / optional improvements

These are useful candidates but not current requirements:

- **Pagefind search** when Journal volume makes search valuable
- **generated Resume PDF** sourced from the existing structured Resume content, never a second manually maintained resume dataset
- **more advanced related-content ranking** if current shared-Topic/Section ranking becomes insufficient
- **additional Custom Page blocks** only when a real page cannot be built cleanly with the constrained set
- **configuration-as-code for Cloudflare** only after the complete existing Pages/Tunnel/Access/R2 configuration is inventoried and can be represented without losing dashboard-managed settings

## Architecture guardrails

- Git-backed content remains portable and authoritative.
- Tina should make owner tasks easier without becoming a second source of truth.
- Keep public output static wherever practical.
- Use structured fields where structure has a clear editorial or rendering benefit; keep prose as Markdown.
- Treat established public slugs/paths as durable. Add redirects before moving them.
- Keep Immich credentials, Cloudflare service tokens, deploy hooks, and other secrets server-side only.
- Public website media should not require the home Immich server to remain online after publication.
- Never hand-edit generated Tina lock data.
- Any schema change must update Tina, Astro validation, stored content, renderers/queries, lock/index state, and tests together.
- Preserve the current visual system unless intentionally redesigning it.

## Definition of done for future work

A feature is complete when applicable items are true:

- implementation is on the latest `gpt-handoff` branch
- stored content remains valid and portable
- Tina editor behavior is verified
- Astro build succeeds
- authoring tests/type checks pass where relevant
- Cloudflare bindings/secrets/access policies are verified when touched
- public routes and responsive rendering are reviewed
- redirects are added for changed public URLs
- security-sensitive endpoints are tested for both allowed and denied access when authentication changes
- the relevant durable documentation above is updated

