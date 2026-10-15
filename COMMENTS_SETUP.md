# Journal comments

## Behavior

Readers provide a name and plain-text comment, with no account or email. All submissions are **pending** until approved. Names are not verified. Only approved comments appear publicly. The owner can approve, reject/hide, return to pending, or permanently delete comments under **Content → Comments** in Tina. Moderation is live: no site rebuild is needed.

The discussion appears below each published Journal article. Readers click **Load comments & join the discussion** before comments or Cloudflare Turnstile load. Articles remain readable if the comment service is unavailable. No comments are stored in Git or authored Markdown; D1 stores visitor comments only.

The **Disable Comments** checkbox on an entry hides its discussion and blocks public comment reads/submissions after saving and publishing. Stored comments remain available to the owner. Existing entries allow comments by default once the service is configured. Renaming an article filename changes its comment identity; migrate its `article` values in D1 deliberately if moving a published entry. Editing the title does not change its comments.

## Why this implementation

| Approach | Reader access | Operations and privacy | Fit |
| --- | --- | --- | --- |
| Giscus / GitHub Discussions | GitHub sign-in and app authorization | Hosted moderation; public comments on GitHub; minimal custom server code | Does not meet the requested name-only access |
| Hosted guest-comment service | Provider dependent; some support guests | Additional provider processes comments/traffic; moderation and plan limits vary | Possible, but adds a separate service dependency |
| Native Cloudflare Pages + D1 + Turnstile | Name only; no account | Owner moderation in the existing admin; database and spam check on Cloudflare; custom code maintained in this repo | Selected for the requested guest access and approval workflow |

This avoids running anything on the home/Immich server. D1 and Pages Functions have metered free allowances; there is no comment-service subscription. Monitor Cloudflare usage rather than assuming unlimited free operation. Official references: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Giscus](https://giscus.app/).

## One-time Cloudflare activation

The code alone does not create Cloudflare resources or activate the service.

1. In Cloudflare **Storage & databases → D1**, create a database named `angrysquirrel-comments` (the database name is arbitrary).
2. Initialize it with every statement in `migrations/0001_journal_comments.sql`, using the D1 SQL console. The file creates the table and indexes and can safely be reapplied. If using an already authenticated Wrangler installation instead, the equivalent is:

   ```bash
   npx wrangler d1 execute angrysquirrel-comments --remote --file=migrations/0001_journal_comments.sql
   ```

3. In the site's **Workers & Pages → Pages project → Settings → Bindings**, add a **D1 database binding**, named exactly `COMMENTS_DB`, pointing to that database. Add it to Production. Do not bind production comments to preview deployments; use a separate database if testing previews.
4. In Cloudflare **Turnstile**, create a **Managed** widget. Add the exact public hostname(s), such as `angrysquirrel.org` and `www.angrysquirrel.org` if both serve the site. Keep pre-clearance off. The client uses action `journal-comment`; the server validates action and the exact request hostname.
5. Add these variables/secrets to the Pages Production environment:

   | Name | Value |
   | --- | --- |
   | `COMMENTS_TURNSTILE_SITE_KEY` | Widget's public site key |
   | `COMMENTS_TURNSTILE_SECRET_KEY` | Widget's secret key; store as an encrypted secret |
   | `COMMENTS_ALLOWED_EMAIL` | Your Cloudflare Access owner email; optional if `PUBLISH_ALLOWED_EMAIL` already matches |

   Existing `CLOUDFLARE_ACCESS_DOMAIN` and `CLOUDFLARE_ACCESS_AUD` are reused for owner authentication. An owner allowlist is required: `COMMENTS_ALLOWED_EMAIL`, falling back to `PUBLISH_ALLOWED_EMAIL`. Never put a real secret in source or paste it into a public comment.
6. Verify that the existing Cloudflare Access application covers `/admin/*`, including `/admin/api/comments`. The public `/api/comments` endpoint and `/comment-articles.json` must remain publicly reachable. The moderation function independently validates Access and the owner email; the dashboard policy is an additional layer.
7. Use **Publish Site** to rebuild/redeploy after configuring bindings and secrets. The deployed build must include the updated Tina bundle, `/functions`, and generated `/comment-articles.json`. There is no new wrangler configuration file to override existing dashboard bindings.
8. In a private browser window, open an article and load the discussion. Submit a test name/comment. Confirm the waiting-for-approval message and verify that the comment is not public. In `/admin/`, open **Content → Comments**, approve it, then refresh the public discussion. Test **Hide / reject** and **Delete permanently** too. Delete the test comment when finished.

Official setup references: [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/), [Turnstile setup](https://developers.cloudflare.com/turnstile/get-started/), [server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Limits, privacy, and moderation

- Names: 1–60 characters; comments: 1–3,000 characters. Plain text is rendered using DOM `textContent` and React escaping, never reader-provided HTML/Markdown.
- No email addresses or raw IP addresses are saved in the comment database. An HMAC of the network address and UTC day is stored with each submission for abuse limits. It is pseudonymous, changes each day, and is retained until that comment is deleted. Cloudflare still processes requests and Turnstile verification under its own policies; this feature does not change Cloudflare's platform logging.
- All submissions require same-origin JSON requests, an empty honeypot, and a valid single-use Turnstile token for the current hostname/action. Server-side checks fail closed if Turnstile, D1, the article manifest, or required configuration is unavailable.
- Rate limits: up to three stored submissions per daily network identifier in ten minutes, and 100 sitewide in ten minutes. People sharing a network share that limit; the daily identifier resets at UTC midnight. Limits are checked inside the SQLite insert. These are spam controls, not identity verification or a guarantee against abuse.
- Public reads return only approved `id`, `name`, `body`, and creation time, scoped to a published, comment-enabled article. They never expose pending/rejected comments, moderation metadata, or rate identifiers. Public and admin lists paginate in batches of 25. Responses use `Cache-Control: no-store` so moderation changes are visible on reload.
- Names can impersonate others. Treat a name as a display label, not an authenticated identity. Review links, spam, personal information, and abusive content before approval. There are no automatic email notifications; check the pending queue in Tina.
- Readers cannot edit/delete their own comments because there are no accounts. The form links to Contact for removal requests. Use **Delete permanently** for removal; **Reject** retains the comment privately for later review. The delete button asks for confirmation.
- Approval/rejection changes appear when a reader next loads comments. Comment text is never returned to the submitter as publicly posted while pending. A lost network response can leave a comment pending even if the UI reports a timeout; refresh the queue before resubmitting.
- Deleting or unpublishing an article removes its comment eligibility at the next deployment. Its stored discussion is retained privately until deleted by the owner or migrated.

## Maintenance and recovery

- Back up/export D1 before migrations or bulk moderation, using Cloudflare's D1 export tools. The Git repository does **not** back up visitor comments.
- Use the database's Cloudflare Time Travel/export facilities when restoring data; available retention depends on the plan. Review restored approved comments before reopening submissions.
- To pause submissions while keeping approved discussions readable, remove/disable `COMMENTS_TURNSTILE_SECRET_KEY` and redeploy. The server returns `accepting: false` and the reader form stays hidden. Restoring the secret and redeploying reopens submissions.
- To hide one discussion, enable **Disable Comments** on the entry and publish. This also blocks direct public API access for that entry.
- If moderation reports unavailable, check the D1 binding/migration, Access domain/audience and email, and Functions logs. Errors intentionally do not expose SQL, keys, raw IPs, or infrastructure details to readers.
- If the challenge fails, check hostname registration, matching widget keys, action validation, browser blockers, and any custom CSP. A CSP must allow `https://challenges.cloudflare.com` for Turnstile scripts and frames. Do not proxy/cache the Turnstile script. The script loads only after the reader opts into the discussion.
- Never deploy a locally generated Tina bundle that points to localhost. Production uses the normal `npm run build` with its existing TinaCloud environment.

## Verification

`npm run test:authoring` exercises real SQLite statements through a D1-compatible adapter, covering pending-only submissions, approval/hiding/deletion, public-data boundaries, pagination, rate limits, eligibility, payload validation, Turnstile rejection, same-origin enforcement, and the owner allowlist. Run `npm run build:astro` and a Tina build after schema/UI changes. Production D1/Access/Turnstile verification requires the live setup and smoke test above.
