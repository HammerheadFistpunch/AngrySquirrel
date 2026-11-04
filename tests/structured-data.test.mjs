import assert from 'node:assert/strict';
import test from 'node:test';
import { createStructuredData, serializeStructuredData } from '../src/lib/structured-data.ts';

const site = { name: 'TheAngrySquirrel', author: 'Patrick Rich', description: 'Portfolio and journal', url: 'https://angrysquirrel.org/' };
const page = { title: 'An article', description: 'An accurate summary', url: 'https://angrysquirrel.org/archive/example/' };

test('article metadata connects the real author, site and page without inventing dates or images', () => {
  const data = createStructuredData(site, { ...page, article: { section: 'Projects', keywords: ['Radio'] } });
  const article = data['@graph'].find(node => node['@type'] === 'BlogPosting');
  assert.equal(article.author['@id'], 'https://angrysquirrel.org/about/#person');
  assert.equal(article.mainEntityOfPage['@id'], page.url + '#webpage');
  assert.equal(article.headline, page.title);
  assert.deepEqual(article.keywords, ['Radio']);
  assert.equal('datePublished' in article, false);
  assert.equal('dateModified' in article, false);
  assert.equal('image' in article, false);
});

test('publication and modification dates retain their distinct meanings', () => {
  const published = new Date('2025-01-01Z');
  const modified = new Date('2026-11-04Z');
  const data = createStructuredData(site, { ...page, image: 'https://angrysquirrel.org/cover.jpg', article: { published, modified, section: 'Automotive', keywords: [] } });
  const article = data['@graph'].find(node => node['@type'] === 'BlogPosting');
  assert.equal(article.datePublished, published.toISOString());
  assert.equal(article.dateModified, modified.toISOString());
  assert.equal(article.image, 'https://angrysquirrel.org/cover.jpg');
});

test('ordinary pages never acquire article metadata and About identifies its subject', () => {
  const data = createStructuredData(site, { ...page, url: 'https://angrysquirrel.org/about/' });
  assert.equal(data['@graph'].some(node => node['@type'] === 'BlogPosting'), false);
  assert.equal(data['@graph'][2]['@type'], 'AboutPage');
  assert.equal(data['@graph'][2].about['@id'], 'https://angrysquirrel.org/about/#person');
});

test('authored strings cannot terminate the JSON-LD script element', () => {
  const value = { headline: '</script><script>alert(1)</script>\u2028\u2029 & "quoted"' };
  const serialized = serializeStructuredData(value);
  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('\u2028'), false);
  assert.deepEqual(JSON.parse(serialized), value);
});


test('custom pages cannot shadow the public privacy or security routes', async () => {
  const { validateFlexiblePagePath } = await import('../src/lib/flexible-pages.ts');
  for (const path of ['privacy', '/privacy/', 'security', 'security/report']) {
    assert.match(validateFlexiblePagePath(path), /reserved/);
  }
  assert.equal(validateFlexiblePagePath('services'), undefined);
});
