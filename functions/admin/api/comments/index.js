import { commentJson, getModerationComments, handleCommentRequest, moderateComment } from '../../../../src/server/comments.js';

export const onRequest = (context) => handleCommentRequest(() => {
    if (context.request.method === 'GET') return getModerationComments(context);
    if (['PATCH', 'DELETE'].includes(context.request.method)) return moderateComment(context);
    return commentJson({ error: 'Method not allowed.' }, 405, { allow: 'GET, PATCH, DELETE' });
});
