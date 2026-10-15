import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { onRequest as publicEndpoint } from '../functions/api/comments.js';
import { onRequest as ownerEndpoint } from '../functions/admin/api/comments/index.js';
import { authorizeCommentsOwner, onRequest as ownerMiddleware } from '../functions/admin/api/comments/_middleware.js';
import { parseCursor, readCommentJson, validateComment, verifyCommentChallenge } from '../src/server/comments.js';

const origin = 'https://angrysquirrel.org';
const article = 'test-story';
const repliesMigration = await readFile(new URL('../migrations/0002_comment_replies.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/0001_journal_comments.sql', import.meta.url), 'utf8');
function setup() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migration);
    sqlite.exec(repliesMigration);
    // D1-compatible binding backed by real SQLite: exercise actual SQL, constraints, and pagination.
    const db = { prepare(sql) {
        const statement = sqlite.prepare(sql);
        return { bind(...args) { return {
            async all() { return { results: statement.all(...args).map(row => ({ ...row })) }; },
            async run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
        }; } };
    } };
    return { sqlite, env: {
        COMMENTS_DB: db, COMMENTS_TURNSTILE_SITE_KEY: 'site-key', COMMENTS_TURNSTILE_SECRET_KEY: 'test-secret',
        ASSETS: { async fetch() { return Response.json([{ id: article, title: 'Test story' }]); } },
    } };
}
function context(env, { method = 'GET', payload, query = '', originHeader = origin, ip = '192.0.2.1', path = '/api/comments' } = {}) {
    return { env, request: new Request(`${origin}${path}?article=${article}${query}`, {
        method, headers: { origin: originHeader, 'content-type': 'application/json', 'cf-connecting-ip': ip },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
    }) };
}
const payload = (extra = {}) => ({ article, name: 'Pat', body: 'A useful comment.', token: 'test-token', ...extra });
async function withChallenge(run) {
    const saved = globalThis.fetch;
    globalThis.fetch = async url => {
        assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
        return Response.json({ success: true, hostname: 'angrysquirrel.org', action: 'journal-comment' });
    };
    try { await run(); } finally { globalThis.fetch = saved; }
}
const insert = (sqlite, { id = crypto.randomUUID(), status = 'pending', time = Date.now(), articleId = article, name = 'Reader', body = 'Text', parentId = null } = {}) => {
    sqlite.prepare('INSERT INTO journal_comments(id,article,name,body,status,created_at,rate_key,parent_id) VALUES(?,?,?,?,?,?,?,?)')
        .run(id, articleId, name, body, status, time, 'fixture', parentId);
    return id;
};

test('new comments stay pending, approved comments become public, hidden/deleted comments disappear', async () => {
    const { sqlite, env } = setup();
    await withChallenge(async () => {
        const submitted = await publicEndpoint(context(env, { method: 'POST', payload: payload({ name: '<img onerror=alert(1)>', body: "<script>alert('x')</script>\n' OR 1=1 --" }) }));
        assert.equal(submitted.status, 202);
        const stored = sqlite.prepare('SELECT * FROM journal_comments').get();
        assert.equal(stored.status, 'pending');
        assert.notEqual(stored.rate_key, '192.0.2.1');
        assert.equal(stored.rate_key.length, 64);
        let publicData = await (await publicEndpoint(context(env))).json();
        assert.deepEqual(publicData.comments, []);
        let ownerData = await (await ownerEndpoint(context(env, { path: '/admin/api/comments' }))).json();
        assert.equal(ownerData.comments.length, 1);
        assert.equal('rate_key' in ownerData.comments[0], false);
        for (const status of ['approved', 'rejected', 'pending', 'approved']) {
            const response = await ownerEndpoint(context(env, { method: 'PATCH', payload: { id: stored.id, status } }));
            assert.equal(response.status, 200);
            publicData = await (await publicEndpoint(context(env))).json();
            assert.equal(publicData.comments.length, status === 'approved' ? 1 : 0);
        }
        assert.equal(publicData.comments[0].body, stored.body);
        assert.deepEqual(Object.keys(publicData.comments[0]).sort(), ['body', 'created_at', 'id', 'name', 'parent_id', 'reply_count']);
        assert.equal((await ownerEndpoint(context(env, { method: 'DELETE', payload: { id: stored.id } }))).status, 200);
        assert.deepEqual((await (await publicEndpoint(context(env))).json()).comments, []);
    });
    sqlite.close();
});

test('article allowlist rejects drafts, disabled comments, arbitrary routes, and missing assets', async () => {
    const { sqlite, env } = setup();
    for (const id of ['draft-story', 'disabled-story', '../../admin']) {
        const response = await publicEndpoint({
            env, request: new Request(`${origin}/api/comments?article=${encodeURIComponent(id)}`),
        });
        assert.ok([400, 404].includes(response.status));
    }
    await withChallenge(async () => {
        assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload({ article: 'draft-story' }) }))).status, 404);
    });
    assert.equal((await publicEndpoint(context({ ...env, ASSETS: undefined }))).status, 503);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM journal_comments').get().count, 0);
    sqlite.close();
});

test('same-origin, JSON size/type, honeypot, field limits and challenge failures block submissions', async () => {
    const { sqlite, env } = setup();
    assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload(), originHeader: 'https://other.test' }))).status, 403);
    assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload(), originHeader: '' }))).status, 403);
    assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload({ website: 'bot' }) }))).status, 400);
    for (const data of [payload({ name: '' }), payload({ name: 'a'.repeat(61) }), payload({ body: '' }), payload({ body: 'a'.repeat(3001) }), payload({ name: 'bad\nname' }), payload({ token: '' })]) {
        assert.throws(() => validateComment(data));
    }
    const oversized = new Request(`${origin}/api/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'a'.repeat(17000) }) });
    await assert.rejects(() => readCommentJson(oversized), error => error.status === 413);
    await assert.rejects(() => readCommentJson(new Request(origin, { method: 'POST', body: '{}' })), error => error.status === 415);
    for (const result of [{ success: false }, { success: true, action: 'other', hostname: 'angrysquirrel.org' }, { success: true, action: 'journal-comment', hostname: 'attacker.test' }]) {
        await assert.rejects(() => verifyCommentChallenge(env, context(env).request, 'token', async () => Response.json(result)));
    }
    const saved = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ success: false });
    try { assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload() }))).status, 400); }
    finally { globalThis.fetch = saved; }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM journal_comments').get().count, 0);
    sqlite.close();
});

test('submission rate limits use SQLite atomically and never approve a comment automatically', async () => {
    const { sqlite, env } = setup();
    await withChallenge(async () => {
        for (let i = 0; i < 3; i++) assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload() }))).status, 202);
        const limited = await publicEndpoint(context(env, { method: 'POST', payload: payload() }));
        assert.equal(limited.status, 429);
        assert.equal(limited.headers.get('retry-after'), '600');
        assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM journal_comments').get().count, 3);
        sqlite.prepare('UPDATE journal_comments SET created_at = ?').run(Date.now() - 601000);
        assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload() }))).status, 202);
        for (let i = 0; i < 99; i++) insert(sqlite);
        assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload(), ip: '192.0.2.2' }))).status, 429);
    });
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM journal_comments WHERE status='approved'").get().count, 0);
    sqlite.close();
});

test('public and owner pagination are bounded and stable when timestamps tie', async () => {
    const { sqlite, env } = setup();
    for (let i = 0; i < 28; i++) insert(sqlite, { status: 'approved', time: 12345 });
    insert(sqlite, { status: 'pending', time: 12345 });
    insert(sqlite, { articleId: 'other-story', status: 'approved', time: 12345 });
    for (const endpoint of [publicEndpoint, ownerEndpoint]) {
        const firstResponse = await endpoint(context(env, { query: '&status=approved' }));
        assert.equal(firstResponse.headers.get('cache-control'), 'no-store');
        const first = await firstResponse.json();
        assert.equal(first.comments.length, 25);
        assert.ok(first.nextCursor);
        const second = await (await endpoint(context(env, { query: `&status=approved&cursor=${encodeURIComponent(first.nextCursor)}` }))).json();
        assert.equal(second.comments.length, endpoint === publicEndpoint ? 3 : 4);
        assert.equal(second.nextCursor, null);
        assert.equal(new Set([...first.comments, ...second.comments].map(x => x.id)).size, endpoint === publicEndpoint ? 28 : 29);
    }
    assert.throws(() => parseCursor('not a cursor'));
    sqlite.close();
});

test('owner authorization fails closed and moderation rejects cross-origin or invalid changes', async () => {
    const { sqlite, env } = setup();
    const ctx = { env: { ...env, PUBLISH_ALLOWED_EMAIL: 'pat@example.test' }, data: {}, next: () => new Response('ok') };
    assert.equal(authorizeCommentsOwner(ctx).status, 403);
    ctx.data = { cloudflareAccess: { JWT: { payload: { email: 'other@example.test' } } } };
    assert.equal(authorizeCommentsOwner(ctx).status, 403);
    ctx.data.cloudflareAccess.JWT.payload.email = 'pat@example.test';
    assert.equal(authorizeCommentsOwner(ctx).status, 200);
    assert.equal((await ownerMiddleware[0](ctx)).status, 503);
    const id = insert(sqlite);
    assert.equal((await ownerEndpoint(context(env, { method: 'PATCH', payload: { id, status: 'approved' }, originHeader: 'https://evil.test' }))).status, 403);
    assert.equal((await ownerEndpoint(context(env, { method: 'PATCH', payload: { id, status: 'invalid' } }))).status, 400);
    assert.equal((await ownerEndpoint(context(env, { method: 'DELETE', payload: { id: crypto.randomUUID() } }))).status, 404);
    sqlite.close();
});

test('missing configuration allows a graceful read and blocks submission', async () => {
    const { sqlite, env } = setup();
    const noDB = { ...env, COMMENTS_DB: undefined };
    assert.deepEqual(await (await publicEndpoint(context(noDB))).json(), { comments: [], nextCursor: null, accepting: false });
    for (const settings of [noDB, { ...env, COMMENTS_TURNSTILE_SECRET_KEY: '' }, { ...env, COMMENTS_TURNSTILE_SITE_KEY: '' }]) {
        assert.equal((await publicEndpoint(context(settings, { method: 'POST', payload: payload() }))).status, 503);
    }
    sqlite.close();
});


test('reply migration preserves existing comments as roots', () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(migration);
    const id = crypto.randomUUID();
    sqlite.prepare("INSERT INTO journal_comments(id,article,name,body,status,created_at,rate_key) VALUES(?,?,?,?,?,?,?)")
        .run(id, article, 'Existing reader', 'Existing comment', 'approved', 123, 'fixture');
    sqlite.exec(repliesMigration);
    const row = sqlite.prepare('SELECT * FROM journal_comments WHERE id = ?').get(id);
    assert.equal(row.parent_id, null);
    assert.equal(row.body, 'Existing comment');
    assert.equal(row.status, 'approved');
    sqlite.close();
});

test('replies wait for approval, nest under their parent, and follow parent visibility/deletion', async () => {
    const { sqlite, env } = setup();
    const parent = insert(sqlite, { status: 'approved', body: 'Parent context' });
    await withChallenge(async () => {
        const response = await publicEndpoint(context(env, { method: 'POST', payload: payload({ parentId: parent }) }));
        assert.equal(response.status, 202);
        assert.match((await response.json()).message, /reply is waiting/);
    });
    const reply = sqlite.prepare('SELECT * FROM journal_comments WHERE parent_id = ?').get(parent);
    assert.equal(reply.status, 'pending');
    let roots = await (await publicEndpoint(context(env))).json();
    assert.equal(roots.comments.length, 1);
    assert.equal(roots.comments[0].reply_count, 0);
    assert.deepEqual((await (await publicEndpoint(context(env, { query: `&parent=${parent}` }))).json()).comments, []);
    const pending = await (await ownerEndpoint(context(env))).json();
    assert.equal(pending.comments[0].parent_name, 'Reader');
    assert.equal(pending.comments[0].parent_body, 'Parent context');
    assert.equal(pending.comments[0].parent_status, 'approved');
    assert.equal((await ownerEndpoint(context(env, { method: 'PATCH', payload: { id: reply.id, status: 'approved' } }))).status, 200);
    roots = await (await publicEndpoint(context(env))).json();
    assert.equal(roots.comments[0].reply_count, 1);
    let replies = await (await publicEndpoint(context(env, { query: `&parent=${parent}` }))).json();
    assert.equal(replies.comments[0].id, reply.id);
    assert.equal(replies.comments[0].parent_id, parent);
    assert.equal(replies.comments[0].reply_count, 0);
    assert.equal((await ownerEndpoint(context(env, { method: 'PATCH', payload: { id: parent, status: 'rejected' } }))).status, 200);
    assert.deepEqual((await (await publicEndpoint(context(env))).json()).comments, []);
    assert.equal((await publicEndpoint(context(env, { query: `&parent=${parent}` }))).status, 404);
    assert.equal((await ownerEndpoint(context(env, { method: 'PATCH', payload: { id: reply.id, status: 'approved' } }))).status, 404);
    assert.equal((await ownerEndpoint(context(env, { method: 'PATCH', payload: { id: parent, status: 'approved' } }))).status, 200);
    replies = await (await publicEndpoint(context(env, { query: `&parent=${parent}` }))).json();
    assert.equal(replies.comments.length, 1);
    assert.equal((await ownerEndpoint(context(env, { method: 'DELETE', payload: { id: parent } }))).status, 200);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM journal_comments').get().count, 0);
    sqlite.close();
});

test('reply targets must be approved roots on the same article; replies cannot have replies', async () => {
    const { sqlite, env } = setup();
    const parent = insert(sqlite, { status: 'approved' });
    const reply = insert(sqlite, { status: 'approved', parentId: parent });
    const pending = insert(sqlite);
    const rejected = insert(sqlite, { status: 'rejected' });
    const other = insert(sqlite, { status: 'approved', articleId: 'other-story' });
    await withChallenge(async () => {
        for (const target of [reply, pending, rejected, other, crypto.randomUUID()]) {
            assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload({ parentId: target }) }))).status, 404);
            assert.equal((await publicEndpoint(context(env, { query: `&parent=${target}` }))).status, 404);
        }
        for (const target of ['bad', 4, {}, []]) {
            assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload({ parentId: target }) }))).status, 400);
        }
    });
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM journal_comments').get().count, 5);
    sqlite.close();
});

test('replies paginate independently without including pending replies or other threads', async () => {
    const { sqlite, env } = setup();
    const parent = insert(sqlite, { status: 'approved' });
    const other = insert(sqlite, { status: 'approved' });
    for (let i = 0; i < 28; i++) insert(sqlite, { status: 'approved', parentId: parent, time: 12345 });
    insert(sqlite, { parentId: parent });
    insert(sqlite, { status: 'approved', parentId: other });
    const first = await (await publicEndpoint(context(env, { query: `&parent=${parent}` }))).json();
    assert.equal(first.comments.length, 25);
    const second = await (await publicEndpoint(context(env, { query: `&parent=${parent}&cursor=${encodeURIComponent(first.nextCursor)}` }))).json();
    assert.equal(second.comments.length, 3);
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.comments, ...second.comments].map(row => row.id)).size, 28);
    const roots = await (await publicEndpoint(context(env))).json();
    assert.equal(roots.comments.length, 2);
    assert.equal(roots.comments.find(row => row.id === parent).reply_count, 28);
    sqlite.close();
});

test('parent visibility is checked again atomically after spam verification', async () => {
    const { sqlite, env } = setup();
    const parent = insert(sqlite, { status: 'approved' });
    const saved = globalThis.fetch;
    globalThis.fetch = async () => {
        sqlite.prepare("UPDATE journal_comments SET status='rejected' WHERE id=?").run(parent);
        return Response.json({ success: true, hostname: 'angrysquirrel.org', action: 'journal-comment' });
    };
    try {
        assert.equal((await publicEndpoint(context(env, { method: 'POST', payload: payload({ parentId: parent }) }))).status, 404);
    } finally { globalThis.fetch = saved; }
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM journal_comments').get().count, 1);
    sqlite.close();
});
