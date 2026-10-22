interface JournalEntry {
    id: string;
    data: { draft?: boolean; pinned?: boolean; date?: Date };
}

// Pins affect Journal lists only; feature selection and homepage recency stay independent.
export function sortJournalEntries<T extends JournalEntry>(entries: readonly T[]): T[] {
    return entries.filter((entry) => !entry.data.draft).sort((a, b) =>
        Number(Boolean(b.data.pinned)) - Number(Boolean(a.data.pinned))
        || (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0)
        || a.id.localeCompare(b.id),
    );
}
