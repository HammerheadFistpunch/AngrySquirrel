import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CommentRow {
    id: string; article: string; name: string; body: string;
    status: string; created_at: number;
    parent_id?: string | null; parent_name?: string; parent_body?: string; parent_status?: string;
}
const endpoint = '/admin/api/comments';
const read = async (response: Response) => {
    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Comment moderation is unavailable. Sign in through /admin and try again.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to manage comments.');
    return data;
};

export function CommentsScreen() {
    const [status, setStatus] = useState('pending');
    const [comments, setComments] = useState<CommentRow[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const generation = useRef(0);
    const load = useCallback(async (nextCursor?: string) => {
        const requestGeneration = ++generation.current;
        setBusy(true); setError(''); setMessage('');
        try {
            const query = new URLSearchParams({ status });
            if (nextCursor) query.set('cursor', nextCursor);
            const data = await read(await fetch(`${endpoint}?${query}`, {
                credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
            }));
            if (requestGeneration !== generation.current) return;
            setComments(previous => nextCursor ? [...previous, ...data.comments] : data.comments);
            setCursor(data.nextCursor);
        } catch (reason) {
            if (requestGeneration === generation.current) setError(reason instanceof Error ? reason.message : 'Unable to load comments.');
        } finally { if (requestGeneration === generation.current) setBusy(false); }
    }, [status]);
    useEffect(() => {
        setComments([]); setCursor(null); void load();
        return () => { generation.current += 1; };
    }, [load]);

    const moderate = async (comment: CommentRow, nextStatus?: string) => {
        if (!nextStatus && !window.confirm(comment.parent_id ? 'Permanently delete this reply? This cannot be undone.' : 'Permanently delete this comment AND all its replies? This cannot be undone.')) return;
        setBusy(true); setError(''); setMessage('');
        try {
            await read(await fetch(endpoint, {
                method: nextStatus ? 'PATCH' : 'DELETE', credentials: 'same-origin',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ id: comment.id, status: nextStatus }), signal: AbortSignal.timeout(15000),
            }));
            setComments(previous => previous
                .filter(item => item.id !== comment.id && (Boolean(nextStatus) || item.parent_id !== comment.id))
                .map(item => nextStatus && !comment.parent_id && item.parent_id === comment.id ? { ...item, parent_status: nextStatus } : item));
            setMessage(nextStatus === 'approved' ? 'Comment approved and visible immediately.' : nextStatus ? 'Comment status updated.' : 'Comment deleted.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update comment.'); }
        finally { setBusy(false); }
    };

    return <main className="comment-moderation" style={{ padding: '2rem', maxWidth: 1000, margin: 'auto', color: '#1f2937' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Journal comments</h1>
        <p style={{ margin: '1rem 0' }}>Readers submit a name and plain-text comment. Comments and one level of replies need approval. Hiding a parent also hides its replies; deleting a parent deletes its replies. Names are not verified. Approval takes effect without publishing the site.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '1rem 0' }}>
            <label>Show <select value={status} disabled={busy} onChange={event => setStatus(event.target.value)}>
                <option value="pending">Pending approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select></label>
            <button type="button" disabled={busy} onClick={() => void load()}>Refresh</button>
        </div>
        {error && <p role="alert" style={{ color: '#b91c1c', margin: '1rem 0' }}>{error} Check COMMENTS_SETUP.md if the service has not been configured yet.</p>}
        <p role="status" aria-live="polite">{busy ? 'Working…' : message}</p>
        {!busy && !error && comments.length === 0 && <p style={{ margin: '1rem 0' }}>No comments in this view.</p>}
        {comments.map(comment => <article key={comment.id} style={{ padding: '1.25rem 0', borderBottom: '1px solid #d1d5db' }}>
            <a href={`/archive/${comment.article}/#comments-heading`} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', overflowWrap: 'anywhere' }}>{comment.article}</a>
            {comment.parent_id && <blockquote style={{ margin: '1rem 0', padding: '.75rem 1rem', background: '#f3f4f6', borderLeft: '3px solid #9ca3af', overflowWrap: 'anywhere' }}>
                <strong>Reply to {comment.parent_name || 'a removed comment'}</strong> · Parent: {comment.parent_status || 'unavailable'}
                {comment.parent_body && <p style={{ marginTop: '.5rem', whiteSpace: 'pre-wrap' }}>{comment.parent_body.slice(0, 240)}{comment.parent_body.length > 240 ? '…' : ''}</p>}
            </blockquote>}
            <p style={{ margin: '.5rem 0', overflowWrap: 'anywhere' }}><strong>{comment.name}</strong> · {new Date(comment.created_at).toLocaleString()}</p>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '1rem 0' }}>{comment.body}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {comment.status !== 'approved' && <button type="button" disabled={busy || Boolean(comment.parent_id && comment.parent_status !== 'approved')} onClick={() => void moderate(comment, 'approved')}>Approve</button>}
                {comment.status !== 'rejected' && <button type="button" disabled={busy} onClick={() => void moderate(comment, 'rejected')}>{comment.status === 'approved' ? 'Hide / reject' : 'Reject'}</button>}
                {comment.status !== 'pending' && <button type="button" disabled={busy} onClick={() => void moderate(comment, 'pending')}>Return to pending</button>}
                <button type="button" disabled={busy} onClick={() => void moderate(comment)}>Delete permanently</button>
            </div>
        </article>)}
        {cursor && <button type="button" style={{ marginTop: 16 }} disabled={busy} onClick={() => void load(cursor)}>Load more</button>}
        <style>{`.comment-moderation button, .comment-moderation select { padding: 8px 12px; border: 1px solid #9ca3af; border-radius: 6px; background: white; color: #1f2937; cursor: pointer; font: inherit; }
            .comment-moderation button:disabled, .comment-moderation select:disabled { opacity: .5; cursor: wait; }
            .comment-moderation button:focus-visible, .comment-moderation select:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }`}</style>
    </main>;
}
