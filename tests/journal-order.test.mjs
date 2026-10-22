import assert from "node:assert/strict";
import test from "node:test";
import { sortJournalEntries } from "../src/lib/journal-order.ts";
import { selectFeaturedJournalEntry } from "../src/lib/featured-journal.ts";

const entry = (id, date, pinned, draft = false) => ({
    id, data: { date: date ? new Date(date) : undefined, pinned, draft },
});

test("multiple pins precede newer unpinned entries, with newest first in each group", () => {
    const entries = [
        entry("recent", "2026-10-20"),
        entry("older-pin", "2026-01-01", true),
        entry("draft-pin", "2026-12-01", true, true),
        entry("newer-pin", "2026-05-01", true),
        entry("old", "2025-01-01", false),
    ];
    const before = [...entries];
    assert.deepEqual(sortJournalEntries(entries).map(({ id }) => id),
        ["newer-pin", "older-pin", "recent", "old"]);
    assert.deepEqual(entries, before);
    assert.equal(selectFeaturedJournalEntry(entries).id, "recent");
    assert.equal(selectFeaturedJournalEntry(entries, "older-pin").id, "older-pin");
});

test("unpinning restores chronology; undated and tied entries have a stable order", () => {
    const pinned = entry("pin", "2026-01-01", true);
    const recent = entry("recent", "2026-10-01");
    assert.equal(sortJournalEntries([recent, pinned])[0], pinned);
    pinned.data.pinned = false;
    assert.equal(sortJournalEntries([recent, pinned])[0], recent);
    assert.deepEqual(sortJournalEntries([entry("b"), entry("a")]).map(({ id }) => id), ["a", "b"]);
    assert.deepEqual(sortJournalEntries([]), []);
});
