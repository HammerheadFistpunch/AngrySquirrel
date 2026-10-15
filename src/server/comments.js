const PAGE_SIZE = 25;
const MAX_REQUEST_BYTES = 16000;
const statuses = new Set(['pending', 'approved', 'rejected']);

export class CommentError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

export const commentJson = (body, status = 200, extra = {}) => Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra },
});

export function requireSameOrigin(request) {
    if (request.headers.get('origin') !== new URL(request.url).origin) {
        throw new CommentError('Please submit comments from this website.', 403);
    }
}

export async function readCommentJson(request) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new CommentError('Expected a JSON request.', 415);
    }
    if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) {
        throw new CommentError('The comment is too large.', 413);
    }
    const reader = request.body?.getReader();
    if (!reader) throw new CommentError('The request is empty.');
    const chunks = [];
    let length = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_REQUEST_BYTES) {
            await reader.cancel();
            throw new CommentError('The comment is too large.', 413);
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
        const parsed = JSON.parse(new TextDecoder().decode(bytes));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        return parsed;
    } catch { throw new CommentError('The request could not be read.'); }
}

export const parseArticle = (value) => {
    if (typeof value !== 'string' || value.length > 300 || !/^[a-z0-9][a-z0-9/_-]*$/.test(value)
        || value.split('/').some(part => !part)) throw new CommentError('Invalid article.');
    return value;
};

export function validateComment(input) {
    const article = parseArticle(input.article);
    if (typeof input.name !== 'string' || typeof input.body !== 'string') {
        throw new CommentError('Enter your name and comment.');
    }
    const name = input.name.trim();
    const body = input.body.trim().replaceAll('\r\n', '\n');
    if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
        throw new CommentError('Use a name between 1 and 60 characters.');
    }
    if (!body || body.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body)) {
        throw new CommentError('Use a comment between 1 and 3,000 characters.');
    }
    if (typeof input.token !== 'string' || !input.token || input.token.length > 2048) {
        throw new CommentError('Complete the spam check and try again.');
    }
    return { article, name, body, token: input.token };
}

const dbFor = (env) => {
    if (!env.COMMENTS_DB) throw new CommentError('Comments are temporarily unavailable.', 503);
    return env.COMMENTS_DB;
};

const submissionsEnabled = (env) => Boolean(env.COMMENTS_DB && env.COMMENTS_TURNSTILE_SITE_KEY && env.COMMENTS_TURNSTILE_SECRET_KEY);

export async function publishedArticle(context, article) {
    if (!context.env.ASSETS) throw new CommentError('Comments are temporarily unavailable.', 503);
    const response = await context.env.ASSETS.fetch(new Request(new URL('/comment-articles.json', context.request.url)));
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        throw new CommentError('Comments are temporarily unavailable.', 503);
    }
    const articles = await response.json();
    const found = articles.find(item => item.id === article);
    if (!found) throw new CommentError('Comments are not available for this article.', 404);
    return found;
}

export function parseCursor(value) {
    if (!value) return { time: 0, id: '' };
    try {
        if (value.length > 200) throw new Error();
        const [time, id] = JSON.parse(atob(value));
        if (!Number.isSafeInteger(time) || time < 0 || !/^[a-f0-9-]{36}$/.test(id)) throw new Error();
        return { time, id };
    } catch { throw new CommentError('Invalid comment page.'); }
}
const nextPage = (rows, limit) => {
    const comments = rows.slice(0, limit);
    const last = comments.at(-1);
    return { comments, nextCursor: rows.length > limit && last ? btoa(JSON.stringify([last.created_at, last.id])) : null };
};

export async function getPublicComments(context) {
    const url = new URL(context.request.url);
    const article = parseArticle(url.searchParams.get('article'));
    await publishedArticle(context, article);
    if (!context.env.COMMENTS_DB) return commentJson({ comments: [], nextCursor: null, accepting: false });
    const cursor = parseCursor(url.searchParams.get('cursor'));
    const { results } = await dbFor(context.env).prepare(`
        SELECT id, name, body, created_at FROM journal_comments
        WHERE article = ? AND status = 'approved' AND (created_at > ? OR (created_at = ? AND id > ?))
        ORDER BY created_at, id LIMIT ?
    `).bind(article, cursor.time, cursor.time, cursor.id, PAGE_SIZE + 1).all();
    return commentJson({ ...nextPage(results, PAGE_SIZE), accepting: submissionsEnabled(context.env),
        siteKey: submissionsEnabled(context.env) ? context.env.COMMENTS_TURNSTILE_SITE_KEY : undefined });
}

export async function verifyCommentChallenge(env, request, token, fetcher = fetch) {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: env.COMMENTS_TURNSTILE_SECRET_KEY, response: token,
            remoteip: request.headers.get('cf-connecting-ip') }),
        signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new CommentError('The spam check is unavailable. Please try again.', 503);
    const result = await response.json();
    if (result.success !== true || result.action !== 'journal-comment' || result.hostname !== new URL(request.url).hostname) {
        throw new CommentError('The spam check expired or failed. Please try again.');
    }
}

export async function submitPublicComment(context) {
    const { request, env } = context;
    requireSameOrigin(request);
    if (!submissionsEnabled(env)) throw new CommentError('Comments are temporarily unavailable.', 503);
    const input = await readCommentJson(request);
    if (input.website) throw new CommentError('The comment could not be submitted.');
    const comment = validateComment(input);
    await publishedArticle(context, comment.article);
    const ip = request.headers.get('cf-connecting-ip');
    if (!ip) throw new CommentError('Comments are temporarily unavailable.', 503);
    await verifyCommentChallenge(env, request, comment.token);
    const now = Date.now();
    // A keyed, daily hash supports rate limits without saving raw IP addresses.
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.COMMENTS_TURNSTILE_SECRET_KEY),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${Math.floor(now / 86400000)}:${ip}`));
    const rateKey = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
    const result = await dbFor(env).prepare(`
        INSERT INTO journal_comments (id, article, name, body, status, created_at, rate_key)
        SELECT ?, ?, ?, ?, 'pending', ?, ?
        WHERE (SELECT COUNT(*) FROM journal_comments WHERE rate_key = ? AND created_at >= ?) < 3
          AND (SELECT COUNT(*) FROM journal_comments WHERE created_at >= ?) < 100
    `).bind(crypto.randomUUID(), comment.article, comment.name, comment.body, now, rateKey,
        rateKey, now - 600000, now - 600000).run();
    if (!result.meta?.changes) throw new CommentError('Too many comments. Please try again in ten minutes.', 429);
    return commentJson({ message: 'Thank you. Your comment is waiting for approval.' }, 202);
}

export async function getModerationComments(context) {
    const db = dbFor(context.env);
    const url = new URL(context.request.url);
    const status = url.searchParams.get('status') || 'pending';
    if (!statuses.has(status)) throw new CommentError('Invalid comment status.');
    const cursor = parseCursor(url.searchParams.get('cursor'));
    const { results } = await db.prepare(`
        SELECT id, article, name, body, status, created_at, moderated_at FROM journal_comments
        WHERE status = ? AND (created_at > ? OR (created_at = ? AND id > ?))
        ORDER BY created_at, id LIMIT ?
    `).bind(status, cursor.time, cursor.time, cursor.id, PAGE_SIZE + 1).all();
    return commentJson(nextPage(results, PAGE_SIZE));
}

export async function moderateComment(context) {
    requireSameOrigin(context.request);
    const db = dbFor(context.env);
    const input = await readCommentJson(context.request);
    if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/.test(input.id)) throw new CommentError('Invalid comment.');
    let result;
    if (context.request.method === 'DELETE') {
        result = await db.prepare('DELETE FROM journal_comments WHERE id = ?').bind(input.id).run();
    } else {
        if (!statuses.has(input.status)) throw new CommentError('Invalid comment status.');
        result = await db.prepare('UPDATE journal_comments SET status = ?, moderated_at = ? WHERE id = ?')
            .bind(input.status, Date.now(), input.id).run();
    }
    if (!result.meta?.changes) throw new CommentError('Comment no longer exists. Refresh the list.', 404);
    return commentJson({ ok: true });
}

export async function handleCommentRequest(action) {
    try { return await action(); }
    catch (error) {
        return commentJson({ error: error instanceof CommentError ? error.message : 'Comments are temporarily unavailable. Please try again later.' },
            error instanceof CommentError ? error.status : 503,
            error instanceof CommentError && error.status === 429 ? { 'retry-after': '600' } : {});
    }
}
