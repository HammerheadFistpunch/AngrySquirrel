interface SiteIdentity {
  name: string;
  description: string;
  author: string;
  url: string;
}

interface PageIdentity {
  url: string;
  title: string;
  description: string;
  image?: string;
  article?: {
    published?: Date;
    modified?: Date;
    section: string;
    keywords: string[];
  };
}

export function createStructuredData(site: SiteIdentity, page: PageIdentity) {
  const siteId = new URL("/#website", site.url).href;
  const authorId = new URL("/about/#person", site.url).href;
  const pageId = `${page.url}#webpage`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite", "@id": siteId, url: site.url,
      name: site.name, description: site.description, inLanguage: "en",
      publisher: { "@id": authorId },
    },
    {
      "@type": "Person", "@id": authorId, name: site.author,
      url: new URL("/about/", site.url).href,
    },
    {
      "@type": new URL(page.url).pathname === "/about/" ? "AboutPage"
        : new URL(page.url).pathname === "/contact/" ? "ContactPage" : "WebPage",
      "@id": pageId, url: page.url, name: page.title,
      description: page.description, inLanguage: "en", isPartOf: { "@id": siteId },
      ...(new URL(page.url).pathname === "/about/" ? { about: { "@id": authorId } } : {}),
    },
  ];
  if (page.article) {
    graph.push({
      "@type": "BlogPosting", "@id": `${page.url}#article`,
      url: page.url, headline: page.title, description: page.description,
      mainEntityOfPage: { "@id": pageId }, isPartOf: { "@id": siteId },
      author: { "@id": authorId }, publisher: { "@id": authorId }, inLanguage: "en",
      articleSection: page.article.section, keywords: page.article.keywords,
      ...(page.article.published ? { datePublished: page.article.published.toISOString() } : {}),
      ...(page.article.modified ?? page.article.published
        ? { dateModified: (page.article.modified ?? page.article.published)!.toISOString() } : {}),
      ...(page.image ? { image: page.image } : {}),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

// JSON is inserted into a script element: prevent authored text closing that element.
export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
