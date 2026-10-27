# AngrySquirrel production and development

## Current status

Prepared on 2026-10-27 from `gpt-handoff` commit `c2b5ccb0c5067e02bf4bee5d71cf78e260a26658`. The repository is still `HammerheadFistpunch/GTP_Port`. Branch preparation does not change Cloudflare hosting, TinaCloud, the GitHub default branch, or deploy hooks. Those dashboard changes and live acceptance checks remain pending.

`gpt-handoff` remains intact as the transition source. Do not delete it or stop preserving its Tina content until the cutover is verified. `master` is an older branch and is not the production baseline.

## Everyday workflow after cutover

| Branch | Purpose | Deployment |
| --- | --- | --- |
| `main` | Production code and normal Tina content edits | `angrysquirrel.org`; deliberate Publish Site |
| `development` | Feature work and test content | Cloudflare development preview; automatic builds |
| `feature/*` | Optional isolated experiments | Optional protected previews; merge into development first |

Continue writing real articles in the production Tina editor. Test features on development, then use a pull request into main. Merging makes code eligible for release; use Publish Site when ready to deploy all saved main changes.

Merge main into development before starting work and again before a release, so newer Tina content is preserved. Resolve conflicts and rerun checks. Remove test entries/images/settings before merging development into main. After release, merge main back into development. Never reset or force-push either branch over newer content.

## One-time dashboard cutover

1. Pause Tina saves briefly. Retrieve the latest `gpt-handoff` head again. If it has advanced since branch preparation, merge those changes into main, preserve both sides, validate, then bring development up to date. Record the current Cloudflare deployment and existing settings for rollback.
2. On GitHub, set the repository default branch to main. The GitHub connection used here supports branch creation and Git Data writes, but does not expose repository settings changes. Keep existing history and branches.
3. In TinaCloud, keep the existing project/client ID and repository connection. Verify main is indexed with the committed Tina lock. Authorize the exact development preview URL as an allowed site origin and verify development indexing before testing its editor. Do not hand-edit the schema lock or regenerate credentials simply because branches changed.
4. In the existing Cloudflare Pages project, go to Settings → Builds & deployments → Configure Production deployments. Set the production branch to main. Keep automatic production deployments disabled to preserve deliberate publishing.
5. Configure custom preview branch controls to include development (optionally feature/*). Exclude the old gpt-handoff branch from automatic previews. Keep the existing build command `npm run build`, output directory `dist`, and supported Node version.
6. Review variables and bindings separately for Production and Preview using the table below. Create a new production deploy hook explicitly targeting main and store its URL only in the Production encrypted `CLOUDFLARE_DEPLOY_HOOK_URL` secret. A main branch variable does not retarget an old hook. Keep the old hook available for rollback until verification, then revoke it.
7. Deploy main manually through the Pages dashboard/new hook for the initial cutover; the old deployed editor still targets the previous setup. Verify `/deployment.json` reports main and the intended SHA before using the new editor.
8. Test the full production acceptance sequence below, resume normal editing, then deploy development as a protected preview. Record the actual development URL here once available. No verified preview URL exists yet.

Cloudflare references: [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/), [deploy hooks](https://developers.cloudflare.com/pages/configuration/deploy-hooks/). Tina: [project settings](https://tina.io/docs/tinacloud/dashboard/projects).

### Environment separation

| Setting | Production | Preview |
| --- | --- | --- |
| `CF_PAGES_BRANCH` | Pages supplies main | Pages supplies development/feature branch; do not override |
| `GITHUB_BRANCH` | Remove stale value or set main | Remove; never force preview to main |
| Tina project ID/read-only token | Existing project values | Same project only if authorized for preview branch/origin |
| `PUBLISH_GITHUB_REPOSITORY` | HammerheadFistpunch/GTP_Port until repository rename | No production publisher configuration needed |
| `PUBLISH_GITHUB_BRANCH` | main | Omit; production publisher is blocked on preview hosts |
| Deploy hook and `PUBLISH_STATE` KV | Existing production binding plus new main hook | No production hook or KV binding |
| Comments D1/Turnstile | Preserve existing production database, keys and bindings | Separate test database with the same migrations and preview-compatible keys, or leave unbound |
| R2 `MEDIA_BUCKET` and media URL | Preserve existing bucket and immutable public URLs | Separate test bucket/domain, or leave unbound |
| Immich/Access credentials | Preserve existing private service configuration | Add only if intentionally testing the picker; retain owner-only authentication |

An unbound test service may report unavailable; that is preferable to test changes reaching production data. Never copy all production secrets/bindings wholesale into Preview. Protect development with Cloudflare Access, including its admin/API routes, before enabling editor/media testing. Verify the preview `X-Robots-Tag: noindex` response header; noindex does not replace access protection.

The publisher rejects every request from preview/local hosts before authentication, GitHub requests, KV access, or deploy-hook requests. It also rejects a stale production branch override. Actual Pages branch identity takes priority in Tina configuration so a stale GITHUB_BRANCH cannot make a preview editor write to main. Local `npm run dev` requires `GITHUB_BRANCH=development` in private `.env` (see `.env.example`).

## Release checks

Run `npm ci`, `npm run test:authoring`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`. The full Tina build requires the existing private Tina environment values; `npm run build:astro` alone does not validate the editor. Review schema/lock changes together and ensure TinaCloud indexes the target branch.

Before merging, open development's public pages and editor and verify saves create commits on development, never main. Test the affected feature with test service bindings. Verify GET/POST/DELETE `/admin/api/publish` all return 403 in the preview, and that no production hook or KV lock is touched.

After merging and publishing main:

1. Confirm `/deployment.json` reports branch main and the intended release commit.
2. Open the homepage, Journal and an article; verify existing media URLs.
3. Save a small real Tina edit and confirm its commit lands on main, without an automatic production build.
4. Verify Publish Site shows Saved versus Live correctly; publish and confirm the new SHA goes live.
5. Verify Quick Field Note, Immich browse/preview/public copy, signed-out comments and owner moderation.
6. Confirm development remains separate and protected.

## Rollback and remaining naming cleanup

If cutover fails, restore the previous successful Pages deployment, previous production branch/variables and old matching hook, and verify Tina edits still target the preserved gpt-handoff branch. Preserve any main commits/content created during the attempt and reconcile them before retrying. A deployment rollback does not reverse D1 writes or R2 objects.

Rename the GitHub repository to AngrySquirrel as a separate coordinated operation after this branch cutover works. Then update the publisher repository fallback, production variable, `.env.example`, documentation URLs, local remotes, Tina connection and Pages Git connection. Existing content, D1 data and public media URLs do not need renaming or recreation. Do not replace the Pages project merely to change a display name: its bindings, Access policies, domains and hooks must be preserved.
