import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

// Only deployed, public Journal routes are eligible to receive comments.
export const GET: APIRoute = async () => {
    const entries = await getCollection('entries', ({ data }) => !data.draft && !data.commentsDisabled);
    return Response.json(entries.map(entry => ({ id: entry.id, title: entry.data.title })));
};
