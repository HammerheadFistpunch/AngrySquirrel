# Journal comments

## Behavior

Readers provide a name and plain-text comment, with no account or email. All submissions are **pending** until approved. Names are not verified. Only approved comments appear publicly. The owner can approve, reject/hide, return to pending, or permanently delete comments under **Content → Comments** in Tina. Moderation is live: no site rebuild is needed.

Readers can reply to approved top-level comments. One level of replies is supported; replies cannot have further replies. Each reply requires its own approval. Approved replies are loaded on demand beneath their parent, with independent pagination. Hiding a parent hides its replies; reapproving the parent restores approved replies. Permanently deleting a parent also deletes all its replies. The moderation screen shows the parent context and blocks approving a reply while the parent is hidden.

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
2. Initialize it with every statement in `migrations/0001_journal_comments.sql`, then apply `migrations/0002_comment_replies.sql` once, using the D1 SQL console. Migration 0001 creates the table and indexes and can safely be reapplied. Migration 0002 adds the reply column; run it only once. If using an already authenticated Wrangler installation instead, the equivalent is:

   ```bash
   npx wrangler d1 execute angrysquirrel-comments --remote --file=migrations/0001_journal_comments.sql
   npx wrangler d1 execute angrysquirrel-comments --remote --file=migrations/0002_comment_replies.sql
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

## Upgrading an already-working comment database for replies

Before publishing the reply update, open **D1 → angrysquirrel-comments → Console** and run `migrations/0002_comment_replies.sql` once:

```sql
ALTER TABLE journal_comments ADD COLUMN parent_id TEXT REFERENCES journal_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS comments_threads ON journal_comments(article, parent_id, status, created_at, id);
CREATE INDEX IF NOT EXISTS comments_parent ON journal_comments(parent_id);
```

Existing comments keep their content/status and receive a null parent, so they remain top-level comments. Old deployed code continues working with the added column. Apply this before deploying new code; new code queries the column. No new keys, bindings, or Tina content fields are required. If you see `duplicate column name: parent_id`, do not repeat the ALTER; use `PRAGMA table_info(journal_comments);` to verify the column and run only the two index statements.

After migration, use **Publish Site** and hard-refresh `/admin/`. On a public article, click **Reply** under an approved comment, submit, approve the pending reply in Tina, reload the discussion, and choose **View replies**. Verify that pending replies stay private and that a reply has no Reply button of its own.

## Limits, privacy, and moderation

- Names: 1–60 characters; comments: 1–3,000 characters. Plain text is rendered using DOM `textContent` and React escaping, never reader-provided HTML/Markdown.
- No email addresses or raw IP addresses are saved in the comment database. An HMAC of the network address and UTC day is stored with each submission for abuse limits. It is pseudonymous, changes each day, and is retained until that comment is deleted. Cloudflare still processes requests and Turnstile verification under its own policies; this feature does not change Cloudflare's platform logging.
- All submissions require same-origin JSON requests, an empty honeypot, and a valid single-use Turnstile token for the current hostname/action. Server-side checks fail closed if Turnstile, D1, the article manifest, or required configuration is unavailable.
- Rate limits: up to three stored submissions per daily network identifier in ten minutes, and 100 sitewide in ten minutes. People sharing a network share that limit; the daily identifier resets at UTC midnight. Limits are checked inside the SQLite insert. These are spam controls, not identity verification or a guarantee against abuse.
- Public reads return only approved `id`, `name`, `body`, creation time, parent ID, and approved reply count, scoped to a published, comment-enabled article. They never expose pending/rejected comments, moderation metadata, or rate identifiers. Public root comments, each reply thread, and admin lists paginate independently in batches of 25. Reply reads require an approved root on the same article; public reply counts exclude pending/rejected replies. Responses use `Cache-Control: no-store` so moderation changes are visible on reload.
- Names can impersonate others. Treat a name as a display label, not an authenticated identity. Review links, spam, personal information, and abusive content before approval. There are no automatic email notifications; check the pending queue in Tina.
- Readers cannot edit/delete their own comments because there are no accounts. The form links to Contact for removal requests. Deleting a parent also permanently deletes every reply under it. Use **Delete permanently** for removal; **Reject** retains the comment privately for later review. The delete button asks for confirmation.
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

`npm run test:authoring` exercises real SQLite statements through a D1-compatible adapter, covering pending-only submissions, one-level reply validation, migration preservation, parent visibility/deletion, approval/hiding/deletion, public-data boundaries, pagination, rate limits, eligibility, payload validation, Turnstile rejection, same-origin enforcement, and the owner allowlist. Run `npm run build:astro` and a Tina build after schema/UI changes. Production D1/Access/Turnstile verification requires the live setup and smoke test above.
