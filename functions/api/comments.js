import { commentJson, getPublicComments, handleCommentRequest, submitPublicComment } from '../../src/server/comments.js';

export const onRequest = (context) => handleCommentRequest(() => {
    if (context.request.method === 'GET') return getPublicComments(context);
    if (context.request.method === 'POST') return submitPublicComment(context);
    return commentJson({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' });
});
