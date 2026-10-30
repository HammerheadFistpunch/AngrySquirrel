# AngrySquirrel.org Site Maintenance Guide

This guide is for code, deployment, infrastructure, schema, security, and recovery work. Owner editing instructions live in `HELP.md`. For step-by-step PowerShell update instructions, see [section 13](#13-updating-the-site-and-its-dependencies-powershell).

## Production and development branches

See [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md) for the pending dashboard cutover, preview isolation, and release procedure. The instructions below describe the target `main` workflow; until cutover finishes, retrieve and preserve newer Tina changes from `gpt-handoff` before advancing `main`. Production publishing is restricted to the public HTTPS site hosts and `main`.

## 1. Maintenance rule: start from the remote branch

Before changing code:

1. retrieve the current remote `main` head;
2. treat that branch as the source of truth;
3. check whether Tina or another editor has added newer content commits;
4. make maintenance changes on top of that exact head.

Do not overwrite newer Tina content with an older local checkout.

## 2. Repository map

| Location | Responsibility |
| --- | --- |
| `src/content/entries/` | Journal MDX entries |
| `src/content/tags/` | Topic documents; public routes remain `/tags/` |
| `src/content/journal-sections/` | Journal Section documents |
| `src/content/pages/` | fixed editable Homepage, Journal, About, Contact, Resume data |
| `src/content/flexible-pages/` | Custom Pages with explicit public paths |
| `src/content/settings/site.md` | navigation/footer/site identity settings |
| `src/content.config.ts` | Astro content validation |
| `tina/config.ts` | Tina collections, fields, navigation behavior |
| `tina/components/` | custom Tina controls, Markdown editor, Immich picker, import UI |
| `tina/components/FieldNoteScreen.tsx` | mobile quick composer; existing Tina content/media APIs and publish relay |
| `tina/lib/fieldNote.ts` | plain-text escaping, metadata defaults, persistent note identity, save recovery |
| `tina/tina-lock.json` | generated Tina schema lock; never hand-edit |
| `src/pages/` | public routes and route-generation logic |
| `src/layouts/` | shared page/entry presentation |
| `src/components/` | reusable UI/content components |
| `src/styles/variables.css` | design tokens, colors, fonts, widths, spacing |
| `src/styles/typography.css` | typography rules |
| `src/styles/global.css` | global CSS and shared imports |
| `src/styles/utilities.css` | shared helper classes |
| `functions/admin/api/publish.js` | Access-protected Cloudflare deploy-hook relay |
| `functions/admin/api/media/` | Access-protected Immich browse/preview/R2 publication endpoints |
| `src/server/media-backend.js` | media validation, Immich requests, deterministic R2 publication |
| `src/pages/deployment.json.ts` | public saved/live deployment comparison manifest |
| `tests/` | authoring/import/schema regression tests |

See `SITE_MAP.md` for the public/Tina/source relationship.

### Quick Field Note

The authenticated Tina screen route is `/admin/#/screens/quick_field_note` (Tina screen slugs use underscores). It creates normal `entries` documents with UUID-based filenames, validates the active `field-notes` section, and uses the configured Tina media store for JPEG uploads. No collection or lockfile change is required.

Local backup uses `angrysquirrel.quick-field-note.v1` in browser localStorage; storage errors do not prevent saving to Tina. Images are decoded, resized, and re-encoded in-browser before upload. Save failures retain the form. If a save response is lost, the same document is read and compared before accepting recovery. A saved public note requests the existing Access-protected `/admin/api/publish` relay; failures offer a retry without creating another entry. Publishing still releases the entire saved branch.

Verification includes `tests/field-note.test.mjs` for metadata, MDX-safe literal text, portable photos, backup validation, and lost-response recovery. `DOCUMENTATION.md`, `PROJECT_LOG.md`, and `BUILD_ORDER.md` referenced by AGENTS.md are absent from this branch; HELP, Roadmap, and this guide remain the available workflow references.

## 3. Local setup and checks

Required Node version: **22.22.0+ on the 22.x line, or 24.x**. The Tina CLI supports these two Node majors.

```bash
npm install
npm run dev
```

Available scripts:

```bash
npm run dev          # Tina-aware Astro development
npm run build        # Tina build + Astro production build
npm run build:astro  # Astro-only build
npm run test:authoring
npm run preview
```

### Full validation gate

Use for schema, route, dependency, import, authoring, or substantial rendering changes:

```bash
npm run test:authoring
npx tsc --noEmit
npm run build
git diff --check
git status --short
```

For isolated Astro visual work where Tina credentials are unavailable, at minimum run:

```bash
npm run build:astro
```

Then manually review the affected routes and responsive states.

## 4. Tina/content schema changes

A schema change is incomplete until all applicable layers agree:

1. `tina/config.ts`
2. `src/content.config.ts`
3. stored Markdown/MDX/frontmatter
4. every route/query/layout/component consumer
5. generated `tina/tina-lock.json`
6. TinaCloud index/editor behavior
7. tests/build

### Safe sequence

1. Pull/resolve the latest `main` head.
2. Update `tina/config.ts`.
3. Update Astro validation if the stored shape changed.
4. Migrate stored content as needed.
5. Update all consumers/renderers/queries.
6. Run Tina locally so the lock is regenerated by Tina tooling.
7. Review the generated lock; never hand-edit it.
8. Run authoring tests, type check, and build.
9. Commit/push the coherent change.
10. Reindex `main` in TinaCloud if required.
11. Open `/admin/` and verify the affected editor.
12. Deliberately publish and verify production.

A TinaCloud reindex cannot repair a stale or contradictory committed schema/lock by itself.

## 5. Content and route safety

### Journal

Every Content Entry is a Journal entry. Current stored/editor model includes title, Markdown body, Journal Section, Draft/Published status, Topics, description, publication date, cover image, and optional gallery.

Do not reintroduce deprecated placement/type/project fields without a deliberate migration design.

### Custom Pages

Custom Pages use explicit `path` values. Folder location is editorial organization only.

Changing a title is normally safe. Changing `path` changes the public URL and should be accompanied by a redirect for established routes.

### Topics and Sections

Treat slugs as durable identifiers. Prefer retirement/aliases over destructive deletion when historical content references a taxonomy item.

## 6. Deliberate publishing system

Tina saves content commits to `main`; production publishing is a separate action.

### Architecture

```text
Tina save
→ GitHub main changes
→ no automatic production rebuild
→ Content > Publish Site
→ /admin/api/publish
→ Access JWT + exact-owner validation
→ server-only Cloudflare deploy hook
→ Cloudflare Pages build
→ /deployment.json reports live commit
```

Automatic production branch deployments should remain disabled unless the deliberate publishing model is intentionally abandoned.

### Runtime values

| Name | Type | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ACCESS_DOMAIN` | variable | Access team domain |
| `CLOUDFLARE_ACCESS_AUD` | variable | Access application audience |
| `PUBLISH_ALLOWED_EMAIL` | variable | exact owner identity allowed to publish |
| `PUBLISH_GITHUB_REPOSITORY` | variable | repository name |
| `PUBLISH_GITHUB_BRANCH` | variable | `main` |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | encrypted secret | production deploy hook |
| `PUBLISH_STATE` | KV binding | duplicate-publish lock |

The deploy hook must never be exposed in browser-delivered code or committed source.

### Publish verification after infrastructure changes

1. Save a harmless Tina change.
2. Verify GitHub receives it.
3. Verify Cloudflare does **not** automatically start a production build.
4. Verify Saved and Live differ in **Publish Site**.
5. Publish once.
6. Verify Cloudflare builds and `/deployment.json` eventually reports the target commit live.

### Failed build recovery

A failed Pages build should not replace the last working deployment.

1. Read the first useful Cloudflare build error.
2. Fix the source/content problem on top of the latest `main`.
3. Push/save the correction.
4. Allow any duplicate-publish lock to clear if necessary.
5. Publish the corrected current branch head.

If the deploy hook may have leaked, revoke it first, create a replacement, update the encrypted secret, then deploy again.

## 7. Immich → R2 media backend

### Architecture

```text
Authenticated Tina editor
→ /admin/api/media/*
→ Cloudflare Access validation + exact-owner check
→ private Immich origin through Cloudflare Tunnel/Access service identity
→ Immich thumbnail/preview variants
→ immutable versioned objects in R2
→ media.angrysquirrel.org
```

Immich is the source library. R2 is the durable public website-media store.

### Protected endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/admin/api/media` | GET | configuration/status without revealing secrets |
| `/admin/api/media/albums` | GET | list albums |
| `/admin/api/media/assets` | GET | browse/search/filter assets |
| `/admin/api/media/preview/:assetId` | GET | private editor preview proxy |
| `/admin/api/media/publish` | POST | copy/reuse public R2 variants |

### Media runtime configuration

| Name | Type | Required | Purpose |
| --- | --- | ---: | --- |
| `MEDIA_BUCKET` | R2 binding | yes | public website image store |
| `MEDIA_PUBLIC_BASE_URL` | variable | yes | `https://media.angrysquirrel.org` |
| `MEDIA_VARIANT_VERSION` | variable | optional | publication recipe version, default `v1` |
| `IMMICH_BASE_URL` | encrypted secret | yes | private Immich origin |
| `IMMICH_API_KEY` | encrypted secret | yes | read-only Immich API key |
| `IMMICH_ACCESS_CLIENT_ID` | encrypted secret | recommended | Access service identity |
| `IMMICH_ACCESS_CLIENT_SECRET` | encrypted secret | recommended | Access service secret |
| `MEDIA_ALLOWED_EMAIL` | variable | optional | exact owner, or falls back to publish identity |
| `CLOUDFLARE_ACCESS_DOMAIN` | variable | yes | shared Access team domain |
| `CLOUDFLARE_ACCESS_AUD` | variable | yes | shared Access audience |

### Immich API permissions

The website media API key should be least-privilege and read-only. Keep only the permissions needed to read/view assets and read albums. Do not grant upload, delete, update, user, admin, or share-management permissions unless architecture changes explicitly require them.

### R2 object strategy

Published media uses immutable revision/version paths similar to:

```text
immich/<asset-id>/<source-revision>/<variant-version>/thumbnail
immich/<asset-id>/<source-revision>/<variant-version>/web
```

Do not overwrite old revisions. Do not automatically delete them; existing Markdown may still reference them.

If Immich image quality/dimensions change, increment `MEDIA_VARIANT_VERSION` so new selections use a new immutable URL recipe.

### Media verification after credential/config changes

While authenticated to `/admin/`:

1. confirm `/admin/api/media` returns configured status;
2. browse at least one asset;
3. confirm private preview works;
4. publish an asset and receive both `thumbnail` and `web` URLs on `media.angrysquirrel.org`;
5. publish the same unchanged asset again and confirm reuse;
6. open the public `web` URL in a private browser session;
7. optionally stop the Immich tunnel temporarily and confirm the R2 URL still works;
8. restore the tunnel and confirm browsing recovers.

### Credential rotation

If an Immich API key or Access service token is suspected exposed, revoke it at the source first, then replace the corresponding encrypted Cloudflare secret and deploy the corrected configuration.

## 8. Cloudflare configuration guidance

The project intentionally relies on existing dashboard-managed Pages bindings/secrets and does not use a partial Wrangler configuration as an incomplete source of truth.

If moving to configuration-as-code later, first inventory and reproduce the complete Pages configuration, including bindings, secrets, Access expectations, KV, R2, deployment behavior, and environment-specific values.

## 9. Visual-system maintenance

Global visual tokens live in `src/styles/variables.css`.

Current font variables:

```css
--font-ui: "Lato", sans-serif;
--font-editorial: "Newsreader", serif;
```

Typography rules live in `src/styles/typography.css`; global behavior is in `src/styles/global.css`; reusable helpers are in `src/styles/utilities.css`.

Prefer modifying a design token for intentional site-wide changes. Prefer scoped component styles for local changes.

After typography/font changes, verify fallback loading, headings, body measure, navigation wrapping, cards, editor previews, and mobile layouts.

## 10. Importer maintenance

The importer accepts frontmatter-bearing Markdown/MDX and body-only Markdown exports. Tina owns canonical serialization of the created draft.

Importer changes should preserve these invariants:

- body-only input reaches Review Import intact
- frontmatter is optional
- title/filename can be inferred then edited
- active Topics are visible/selectable
- unsafe executable MDX and credential-bearing URLs are rejected
- existing files are never overwritten
- imported output becomes a Draft in the normal Journal collection
- ordinary Markdown stays portable

Article title sizing and header spacing are scoped to `src/layouts/EntryLayout.astro`. Titles use a compact 32–48px responsive range rather than the global display-heading size.

Preview typography is scoped in `tina/components/MarkdownBodyField.tsx` because Tina resets native heading/list/emphasis styles. Keep source text readable, heading sizes compact, and semantic formatting visible without allowing arbitrary inline styles through the sanitizer.

Run `npm run test:authoring` after importer, Markdown editor, or Journal schema changes.

## 11. Security checklist

Periodically verify:

- `/admin/` requires Cloudflare Access
- `/admin/api/publish` rejects unauthenticated/wrong-identity requests
- `/admin/api/media/*` rejects unauthenticated/wrong-identity requests
- secrets do not appear in source, frontmatter, browser bundles, logs, or public JSON
- Immich origin is not publicly exposed through an inbound home-server port
- R2 public objects do not reveal private Immich URLs or credentials
- deploy hook remains encrypted/server-only
- Access service-token values remain paired and encrypted
- old R2 revisions are removed only after repository reference checks
- public gallery/share architecture is reviewed separately because it has different privacy characteristics from single-image R2 publication

## Featured Journal selection

Entries have an optional `pinned` boolean (default false). `src/lib/journal-order.ts` sorts published Journal and Section lists by pin status, then descending date, then ID for ties. The feature is removed from the main list before sorting to avoid duplication. Keep homepage recent stories, RSS, Topic archives, and the shared featured selector on their existing chronology. Regenerate the Tina lock with tooling after changing this field.

`src/content/pages/journal.md` owns `featuredEntry`. Both homepages use `src/lib/featured-journal.ts` to resolve references and select only published stories, with the newest published entry as fallback. Do not add a second featured-story setting to `home.md` or its Tina schema. Update the shared selector and its tests if selection behavior changes.

## Journal comment operations

Follow [COMMENTS_SETUP.md](COMMENTS_SETUP.md) for D1/Turnstile activation, Access protections, live checks, privacy, moderation, backup, and recovery. Visitor comments live in the `COMMENTS_DB` D1 binding, not Git. Apply `migrations/0001_journal_comments.sql` before enabling submissions and `migrations/0002_comment_replies.sql` once before deploying replies. A parent must be approved and on the same article; only one reply level is allowed. Hiding a parent hides its thread, and deleting a parent permanently deletes its replies. Existing Access configuration protects **Content → Comments** through `/admin/api/comments`; keep the reader endpoint `/api/comments` public. Article eligibility comes from the deployed `/comment-articles.json` manifest. Never expose pending comments or IP-derived rate keys through public APIs.

## 12. Documentation maintenance

Keep only these durable project docs current:

- `README.md`
- `HELP.md`
- `Roadmap.md`
- `SITE_MAINTENANCE_GUIDE.md`
- `SITE_MAP.md`
- `COMMENTS_SETUP.md`

When a feature changes, update the appropriate durable guide in the same change. Implementation history belongs in Git commits/issues rather than permanent sprint logs.

## 13. Updating the site and its dependencies (PowerShell)

Use this section for routine updates. These instructions assume Windows PowerShell or PowerShell 7. Run commands **one line at a time** and stop if an update or validation command fails. PowerShell does not always stop automatically when an external command fails. `npm outdated` returning a list/nonzero exit code is an expected exception: it is a report, not a failed installation.

### What gets updated where?

| Component | Where to update it | What an interruption affects |
| --- | --- | --- |
| Immich server + machine learning | Home server, Immich Compose folder | Photo library and website picker |
| Caddy | Same Compose folder | Photo/share access routed through Caddy |
| cloudflared | Same Compose folder | Private website-to-Immich connection |
| Immich Public Proxy | Same Compose folder | Shared albums and any galleries using them |
| PostgreSQL + Valkey (`redis`) | Same Compose folder, following Immich release instructions | Immich and everything that depends on it |
| TinaCMS + CLI + Astro integration | Local AngrySquirrel website checkout | Editor and site builds after deployment |
| Astro + MDX integration | Local website checkout | Public site generation |
| Other npm packages | Local website checkout | Depends on the package; test before publishing |
| Node.js + npm | Development PC and Pages build configuration | Local/cloud builds |
| Docker Desktop + WSL | Home server | All containers on that Docker installation |
| Pages/Functions, Access, Tunnel service, R2, KV, D1, Turnstile, TinaCloud, GitHub | Provider-managed | No local server package to upgrade; maintain configuration, credentials, and usage |

Published R2 images remain available when home-server services are offline. Public galleries that read Immich shares directly still depend on the home server. Updating Docker Desktop does **not** update container images; updating TinaCMS packages does **not** update the hosted TinaCloud service.

### A. Before updating Docker services

Open PowerShell **on the home server**. The recorded folder is `C:\IMMICH`; use your actual folder if it has moved. Stay in the same Compose project/folder so Docker reuses the existing configuration and volumes.

```powershell
Set-Location C:\IMMICH
docker compose config --services
docker compose ps
docker compose images
```

The recorded service names are `immich-server`, `immich-machine-learning`, `database`, `redis`, `caddy`, `cloudflared`, and `immich-public-proxy`. Use the names printed by `config --services` if your configuration differs. Compose commands take **service names**, not container names such as `immich_server`.

Before making changes:

1. Note the working image versions from `docker compose images`.
2. Make a dated copy of your Compose file, `.env`, and Caddy configuration into a private backup folder outside Git. Include any Compose override files. `.env` contains secrets.
3. Before an Immich/database update, confirm you have a recent usable **database backup and original photo/video backup**, including external libraries. A copy of the Compose file is not a photo/database backup. Follow [Immich backup and restore](https://docs.immich.app/administration/backup-and-restore/); do not copy a running PostgreSQL data directory as your only backup.
4. Read the target release notes before changing versions, especially when skipping releases.

`pull` downloads the image; `up -d` replaces the running container when its image/configuration has changed. `restart` alone does not install the downloaded image. `--no-deps` keeps an individual update from starting/recreating its dependencies. No `docker compose down` is needed. Never use `down -v` or delete volumes as an update step.

If an image uses a fixed version tag, pulling fetches that version, not a later version. Edit its `image:` tag first when intentionally changing versions. An `@sha256:...` digest pins the exact image even if the tag moves. Keep database/cache pins until an Immich-supported update calls for changing them.

### B. Update cloudflared (website Immich picker connection)

Your recorded image is `cloudflare/cloudflared:latest`. From the Immich folder:

```powershell
docker compose pull cloudflared
docker compose up -d --no-deps cloudflared
docker compose exec cloudflared cloudflared --version
docker compose logs --tail 50 cloudflared
```

Look for `Registered tunnel connection`, then open **Choose from Immich** in Tina and browse/preview a photo. Check the connector is healthy in Cloudflare's Tunnel dashboard. Its token and hostname routes are reused; no new tunnel is needed. Expect a brief picker interruption during restart. For Docker, update the image rather than running `cloudflared update` inside the container.

### C. Update Caddy (photo/share access)

Your recorded image is `caddy:latest`. Preserve the existing Caddyfile mounts and certificate/data volumes.

```powershell
docker compose pull caddy
docker compose up -d --no-deps caddy
docker compose exec caddy caddy version
docker compose logs --tail 50 caddy
```

Open `https://photos.angrysquirrel.org` and a known `https://share.angrysquirrel.org` album. Confirm HTTPS and the expected login/share behavior still work. If you later use a custom Caddy image with plugins, update/rebuild that custom image; replacing it with the stock image can remove required plugins.

### D. Update Immich server and machine learning together

1. Complete the database/media backups in A.
2. Open [Immich releases](https://github.com/immich-app/immich/releases) and read the notes from your installed version through the intended version. Follow any required intermediate upgrades or Compose/database changes first.
3. Review the mobile-app compatibility instructions for that release and update clients as required.
4. Open your local `.env`:

```powershell
notepad .env
```

Find `IMMICH_VERSION`. If it contains a fixed version, set it to the exact stable release you chose (including the `v` prefix used by Immich tags). Save and close Notepad. If it is `release`, a pull follows the moving release tag; check the release notes before pulling. Prefer an explicit version when you want control over major upgrades. Do not change your upload/database paths or credentials.

5. If release notes require Compose changes, merge them into your existing file. Do not overwrite your customized stack with the stock download: that would discard Caddy, cloudflared, the proxy, and local settings.
6. For an application-only update with the existing database/cache still compatible and running, run:

```powershell
docker compose pull immich-server immich-machine-learning
docker compose up -d --no-deps immich-server immich-machine-learning
docker compose ps
docker compose logs --tail 100 immich-server immich-machine-learning
```

If the release requires database/cache changes, use E first and follow the release's complete sequence instead of treating it as an application-only update. This targeted procedure avoids accidentally upgrading unrelated services in the shared stack.

7. Allow startup/migrations to finish. Confirm the server version in Immich, open an existing photo/video, upload a test photo, and check the mobile app. In Tina, browse an album, preview an image, and publish/select a website copy. Open its R2 URL while signed out. An Immich API change can affect the picker even when Immich's own UI works.

### E. Update PostgreSQL and Valkey (the `database` and `redis` services)

These are Immich infrastructure, not independent “latest” upgrades. Your recorded stack pins a PostgreSQL/vector-extension image and a Valkey image by digest. Use the compatible images specified by the target Immich release. Do not replace them with generic `postgres:latest` or `redis:latest`, or change only PostgreSQL's major version.

1. Back up the database and media, and keep the old Compose/configuration files.
2. Read the target Immich database/migration instructions. A PostgreSQL major upgrade may require export/restore or another migration; changing the image alone is insufficient.
3. Edit the relevant `image:` lines with the **complete compatible tag/digest** from those instructions.
4. For a compatible image replacement where the instructions do not prescribe another sequence, stop Immich writers first, update infrastructure, and then restart the application:

```powershell
docker compose stop immich-server immich-machine-learning
docker compose pull database redis
docker compose up -d --no-deps database redis
docker compose ps
docker compose logs --tail 100 database redis
```

5. Wait until the database/cache are ready and healthy. If either fails, stop here and use the migration/recovery instructions. Once healthy:

```powershell
docker compose up -d --no-deps immich-server immich-machine-learning
docker compose logs --tail 100 immich-server
```

Complete the checks in D. Do not interrupt a running database migration. Immich does not support routine downgrades; reverting the image after a schema migration may require restoring the pre-update database and matching application/configuration.

### F. Update Immich Public Proxy (shared albums)

Check [the proxy project/release notes](https://github.com/alangrainger/immich-public-proxy) for compatibility with your Immich version. Your recorded image uses `latest`.

```powershell
docker compose pull immich-public-proxy
docker compose up -d --no-deps immich-public-proxy
docker compose logs --tail 50 immich-public-proxy
```

Open a known shared album while signed out, then check any website gallery using that album. Only deliberately shared material should be visible.

### G. Prepare the website checkout for package updates

Use PowerShell on your development PC. This is the **website repository folder**, not `C:\IMMICH`. Enter the actual folder path when prompted:

```powershell
$siteFolder = Read-Host 'Full path to your AngrySquirrel checkout'
Set-Location $siteFolder
git status --short
git remote -v
```

Confirm this is `HammerheadFistpunch/AngrySquirrel`. If status lists existing work, commit or otherwise preserve it before continuing; do not discard it. Then run:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
$updateBranch = 'maintenance/dependencies-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
git switch -c $updateBranch
node --version
npm --version
npm ci
npm outdated
```

The repository supports Node **22.22.0+ on the 22.x line, or 24.x**; also satisfy any higher minimum of the packages you intend to install. `npm ci` installs the committed versions reproducibly. In `npm outdated`, **Current** is installed, **Wanted** fits the declared version range, and **Latest** can include a breaking major release. A package with an exact version, such as `marked` or `yaml` in the current manifest, will not advance with a plain `npm update`.

Update one related group below, then do J before moving to another group. Read migration notes before using `@latest`, which may cross a major version. Do not use `npm audit fix --force` or `--legacy-peer-deps` to bypass an unexplained compatibility failure.

### H. Update TinaCMS, its CLI, and Astro integration

The tested package baseline is `tinacms` **3.15.0**, `@tinacms/cli` **4.0.3**, and `@tinacms/astro` **0.8.0**. The CLI supports Node 22.x/24.x; the Astro integration supports this site's Astro 6.x. These package families use independent version numbers. `typescript` is an explicit development dependency so the type-check command uses the real compiler.

You can ask ChatGPT to carry out this repository update through the connected GitHub App; a local website checkout on your own PC is optional. The PowerShell instructions below are for performing the same work yourself. In either workflow, commit package changes and the generated Tina lock together, then use **Publish Site** to deploy with the existing Cloudflare credentials.

Read [Tina's upgrade guide](https://tina.io/docs/guides/upgrade-to-latest-version). Upgrade `tinacms` and `@tinacms/cli` together; their version numbers do not have to match. Check that `@tinacms/astro` supports the chosen Tina/Astro versions.

For routine updates within the existing declared ranges:

```powershell
npm update tinacms @tinacms/cli @tinacms/astro
npm run dev
```

For an intentional move to the latest releases, after checking their migration/compatibility notes, use this **instead of** the `npm update` command:

```powershell
npm install tinacms@latest @tinacms/cli@latest @tinacms/astro@latest
```

Then run `npm run dev`. Use the Tina-aware server, open its `/admin/` editor, and allow Tina to regenerate `tina/tina-lock.json`. Test editing, the Markdown toolbar, Quick Field Note, and the Immich picker. Press **Ctrl+C** when finished.

Review and commit the generated schema lock with `package.json`/`package-lock.json` changes. Never edit the lock manually. Complete J before publishing. If the deployed editor reports **GraphQL Schema Mismatch**, confirm the updated schema/lock are committed to `main`, let TinaCloud finish indexing that branch, then reload. Use the available TinaCloud reindex action if needed; reindexing alone cannot fix a stale committed lock.

### I. Update Astro/MDX and the other npm dependencies

For routine Astro updates within the declared ranges:

```powershell
npm update astro @astrojs/mdx
```

For an intentional latest-version upgrade, read [Astro's upgrade guides](https://docs.astro.build/en/upgrade-astro/) and use `npx @astrojs/upgrade` **instead**. It updates Astro and official integrations together. Check Tina's Astro integration compatibility before accepting a major upgrade.

The remaining direct dependencies in the current `package.json` are:

| Package/group | Update approach |
| --- | --- |
| `@cloudflare/pages-plugin-cloudflare-access` | `npm update @cloudflare/pages-plugin-cloudflare-access` within its current range; verify Access/admin APIs afterward |
| `marked`, `yaml` | Currently exact pins; after reviewing release notes, run `npm install marked@latest` or `npm install yaml@latest`, one at a time, and review the new pin/range |
| `@types/node`, `@types/react` | Update declarations compatible with the project's runtime/framework versions; `npm update @types/node @types/react` stays within declared ranges |
| Nested/transitive packages | Normally updated through their parent packages and `package-lock.json`; review `npm audit` findings rather than adding arbitrary direct dependencies |

For a planned broad refresh within all currently declared ranges, `npm update` is available, but it can affect several groups at once and leaves exact pins unchanged. Complete the full checks below. `npm install`/`npm update` change the lockfile; deleting it is not a routine update step.

### J. Test, commit, and deliberately publish website updates

Run these separately, stopping at the first failed check:

```powershell
npm run test:authoring
npx tsc --noEmit
npm run build
git diff --check
git diff --stat
git status --short
```

The full build needs the existing TinaCloud environment variables. Keep `.env` and `TINA_TOKEN` private. `npm run build:astro` is useful for isolated diagnosis, but does not replace Tina/full-build checks for a dependency upgrade.

Review the package/lock diffs and any migration changes. Stage only the intended files (include other reviewed migration files if needed):

```powershell
git add package.json package-lock.json tina/tina-lock.json
git diff --cached --stat
git commit -m 'Update site dependencies'
git push -u origin $updateBranch
```

Use your existing Git credentials or ask ChatGPT to publish through the connected GitHub App; no new GitHub CLI login is required for that workflow. On GitHub, create a pull request from the maintenance branch into **`main`**. Review/merge it after checks pass, preserving any newer Tina content. Then:

1. Wait for TinaCloud to index `main` and verify the editor loads.
2. Use **Content → Publish Site** (or the existing deliberate Cloudflare deploy hook if the editor itself is broken). A Git push/merge alone is not intended to rebuild production.
3. Confirm the Pages deployment succeeds and `/deployment.json` reports the intended deployed commit. Publishing releases all saved branch changes, including newer Tina content.
4. Check homepage, Journal, an article, `/admin/`, picker browse/preview/R2 publication, and comments/moderation if the update touches them. Public comments must work signed out; admin APIs must still require Access.

If a build fails, the previous successful Pages deployment stays live. Fix the failure before republishing. If an update deploys but breaks the site, roll back to the prior successful Pages deployment for immediate recovery, then revert the specific dependency change through GitHub and deliberately publish the corrected branch. Do not reset/force-push an old branch snapshot over newer content. Remember that a Pages rollback does not restore D1 data or reverse database migrations.

### K. Update Node.js and npm

1. Run `node --version` and `npm --version` on the development PC.
2. Use your existing Node installation method. For a normal Windows installer installation, download a supported **LTS Windows installer** from [nodejs.org](https://nodejs.org/en/download). If you use a version manager, update through that manager instead of mixing installations.
3. Close/reopen PowerShell and verify the versions again. npm is bundled with Node; a separate global “latest npm” upgrade is not normally needed.
4. In the website folder, run `npm ci` and the checks in J.
5. Check the Pages build's Node selection (`NODE_VERSION` or the project's chosen version-file mechanism) uses the same supported major version. Update it deliberately and deploy/test; changing Node on your PC does not change Cloudflare's build runtime. Update the repository's engine requirement only when intentionally changing the supported minimum.

### L. Update Docker Desktop and WSL

This affects every Docker stack on the server, including projects outside this website.

1. Finish backups and pick a time when the home services can be offline.
2. Open Docker Desktop and use its update notification or **Check for updates**, then apply/restart as requested.
3. If WSL needs updating, run PowerShell as administrator:

```powershell
wsl --update
wsl --version
```

4. Reboot if requested, start Docker Desktop, and wait until its engine is running. Then check:

```powershell
docker version
docker compose version
Set-Location C:\IMMICH
docker compose ps
```

If stack services did not restart, run `docker compose up -d` from their existing project folder. Check photo/share access and the picker again. Avoid `wsl --shutdown` while services are in use: it stops the WSL environment used by Docker.

### M. Cloudflare/TinaCloud/GitHub services and comment storage

There is no local upgrade command for Pages hosting/Functions runtime, Access, R2, KV, D1, Turnstile, TinaCloud, or GitHub. Providers update these services. Your responsibilities are package compatibility, build settings, bindings, credentials, migrations, backups, and checking provider notices.

- **Pages/Functions and Access:** keep production deployments deliberate, preserve existing bindings/secrets, and verify owner-only admin/publish/media access after a configuration/runtime change. Update the npm Access plugin using I, not by changing Access policies at random.
- **Tunnel:** Cloudflare manages the hosted service; you update the local `cloudflared` connector using B.
- **R2/KV:** preserve bucket/binding names and immutable media URLs. Do not delete old R2 objects or recreate stores as an update step.
- **D1/comments:** follow [COMMENTS_SETUP.md](COMMENTS_SETUP.md) for backup/export and migration instructions. Apply only new required migrations once, in their documented order, to the intended database. Site rollback does not undo database changes.
- **Turnstile/TinaCloud/GitHub:** keep account integrations and keys valid; rotate credentials when required and update the matching encrypted configuration. Keep public comment submission and owner moderation working.

### Official update references

- [Docker Compose pull](https://docs.docker.com/reference/cli/docker/compose/pull/) and [up](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Immich upgrading](https://docs.immich.app/install/upgrading/) and [backup/restore](https://docs.immich.app/administration/backup-and-restore/)
- [Cloudflared updates](https://developers.cloudflare.com/tunnel/guides/update-cloudflared/)
- [Caddy installation/images](https://caddyserver.com/docs/install)
- [TinaCMS upgrading](https://tina.io/docs/guides/upgrade-to-latest-version)
- [Astro upgrading](https://docs.astro.build/en/upgrade-astro/)
- [npm update](https://docs.npmjs.com/cli/v11/commands/npm-update/) and [outdated](https://docs.npmjs.com/cli/v11/commands/npm-outdated/)
