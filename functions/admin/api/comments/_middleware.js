import cloudflareAccessPlugin from '@cloudflare/pages-plugin-cloudflare-access';
import { commentJson } from '../../../../src/server/comments.js';

const authenticate = async (context) => {
    const domain = context.env.CLOUDFLARE_ACCESS_DOMAIN;
    const aud = context.env.CLOUDFLARE_ACCESS_AUD;
    if (!domain || !aud) return commentJson({ error: 'Cloudflare Access is not configured for comment moderation.' }, 503);
    return cloudflareAccessPlugin({ domain, aud })(context);
};

export const authorizeCommentsOwner = (context) => {
    const allowed = (context.env.COMMENTS_ALLOWED_EMAIL || context.env.PUBLISH_ALLOWED_EMAIL || '').trim().toLowerCase();
    const email = context.data.cloudflareAccess?.JWT?.payload?.email?.toLowerCase();
    if (!allowed || email !== allowed) return commentJson({ error: 'This identity cannot moderate comments.' }, 403);
    return context.next();
};

export const onRequest = [authenticate, authorizeCommentsOwner];
