import assert from "node:assert/strict";
import test from "node:test";
import { selectFeaturedJournalEntry } from "../src/lib/featured-journal.ts";

const older = { id: "older-story", data: { date: new Date("2026-01-01") } };
const newest = { id: "newest-story", data: { date: new Date("2026-10-01") } };
const draft = { id: "draft-story", data: { date: new Date("2026-12-01"), draft: true } };
const entries = [older, draft, newest];

test("the shared feature resolves Tina filenames regardless of case and path separators", () => {
    for (const reference of ["src/content/entries/Older-Story.mdx", "src\\content\\entries\\Older-Story.mdx"]) {
        assert.equal(selectFeaturedJournalEntry(entries, reference), older);
    }
});

test("empty, missing, and draft selections fall back to the newest published story", () => {
    for (const reference of [undefined, "", "src/content/entries/missing.mdx", "src/content/entries/draft-story.mdx"]) {
        assert.equal(selectFeaturedJournalEntry(entries, reference), newest);
    }
    assert.deepEqual(entries, [older, draft, newest]);
});

test("no published stories yields no feature", () => {
    assert.equal(selectFeaturedJournalEntry([], "older-story"), undefined);
    assert.equal(selectFeaturedJournalEntry([draft]), undefined);
});
