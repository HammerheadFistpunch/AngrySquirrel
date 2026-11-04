import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { createJournalSectionRegistry } from "../lib/journal-sections";

export const prerender = true;

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("https://angrysquirrel.org");

  const entries = await getCollection("entries", ({ data }) => !data.draft);
  const flexiblePages = await getCollection(
    "flexiblePages",
    ({ data }) => !data.draft,
  );
  const tags = await getCollection("tags");
  const sectionRegistry = createJournalSectionRegistry(await getCollection("journalSections"));

  const routes = new Map<string, string | undefined>();
  const add = (path: string, lastmod?: Date) => {
    const url = new URL(path, base).href;
    routes.set(url, lastmod?.toISOString());
  };

  ["/", "/about/", "/contact/", "/privacy/", "/security/", "/journal/", "/resume/", "/tools/", "/tools/online/", "/tools/tire-thermal/"].forEach((path) =>
    add(path),
  );

  sectionRegistry.active.forEach(({ slug }) => add(`/journal/${slug}/`));
  tags.forEach((tag) => add(`/tags/${tag.data.slug}/`));
  flexiblePages.forEach((page) => add(`/${page.data.path.replace(/^\/+|\/+$/g, "")}/`));
  entries.forEach((entry) =>
    add(`/archive/${entry.id}/`, entry.data.updatedDate ?? entry.data.date),
  );

  const body = [...routes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([loc, lastmod]) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>${
          lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""
        }\n  </url>`,
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
};
