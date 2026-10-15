interface JournalEntry {
    id: string;
    data: { draft?: boolean; date?: Date };
}

const referenceId = (reference: string) => reference
    .replaceAll("\\", "/")
    .replace(/^src\/content\/entries\//, "")
    .replace(/\.mdx?$/i, "")
    .toLowerCase();

// Both Journal surfaces share one selection and one published-only fallback.
export function selectFeaturedJournalEntry<T extends JournalEntry>(entries: T[], reference?: string): T | undefined {
    const published = entries.filter((entry) => !entry.data.draft);
    const selected = reference ? referenceId(reference) : undefined;
    return published.find((entry) => referenceId(entry.id) === selected)
        ?? published.sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0))[0];
}
