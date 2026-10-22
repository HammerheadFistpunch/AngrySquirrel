import { getImageSourceError } from "../../src/lib/image-sources.ts";

export interface NotePhoto { src: string; alt: string }
export interface FieldNote {
    id: string;
    date: string;
    note: string;
    title: string;
    photos: NotePhoto[];
}

export const newFieldNote = (): FieldNote => ({
    id: crypto.randomUUID(), date: new Date().toISOString(), note: "", title: "", photos: [],
});

// This composer accepts plain text, including braces and angle brackets from dictation.
export const noteMarkdown = (text: string) => text.replace(/\\/g, "\\\\")
    .replace(/([`*{}\[\]()<>!#_~|])/g, "\\$1")
    .replace(/^(\s*\d+)\./gm, "$1\\.")
    .replace(/^(\s*)([-+])/gm, "$1\\$2")
    .replace(/^(\s*)(import|export)(?=\s)/gm, (_, space: string, word: string) => `${space}&#${word.charCodeAt(0)};${word.slice(1)}`);

const compact = (text: string) => text.trim().replace(/\s+/g, " ");

export const fieldNoteParams = (entry: FieldNote, draft: boolean, section = "field-notes") => {
    const note = entry.note.trim();
    if (!note) throw new Error("Write a note before saving.");
    if (!section) throw new Error("The Field Notes section is unavailable.");
    for (const photo of entry.photos) {
        if (!photo.src.trim() || getImageSourceError(photo.src)) throw new Error("A photo has an unsupported address. Remove it and try again.");
    }
    const title = compact(entry.title) || compact(note.split(/\r?\n/)[0]).slice(0, 80);
    // EntryLayout already displays the cover above the note; do not repeat it in the body.
    const images = entry.photos.slice(1).map((photo) => {
        const src = photo.src.trim().replace(/[\s()<>]/g, (character) => character === "(" ? "%28" : character === ")" ? "%29" : encodeURIComponent(character));
        return `![${noteMarkdown(compact(photo.alt))}](${src})`;
    });
    return {
        title, description: compact(note).slice(0, 160), date: entry.date,
        draft, journalSection: section,
        ...(entry.photos[0] ? { coverImage: entry.photos[0].src.trim() } : {}),
        body: [noteMarkdown(note), ...images].join("\n\n"),
    };
};

export const fieldNotePath = (entry: FieldNote) => {
    if (!/^[a-f0-9-]{36}$/.test(entry.id) || !Number.isFinite(Date.parse(entry.date))) {
        throw new Error("This note's saved identity is invalid. Copy the text and start a new note.");
    }
    return `field-note-${entry.date.slice(0, 10)}-${entry.id}.mdx`;
};

export const readStoredNote = (source: string | null): FieldNote | undefined => {
    if (!source) return;
    try {
        const value = JSON.parse(source);
        if (typeof value.note !== "string" || typeof value.title !== "string" || !Array.isArray(value.photos)) return;
        fieldNotePath(value);
        if (value.photos.some((photo: NotePhoto) => !photo || typeof photo.src !== "string" || typeof photo.alt !== "string" || !photo.src || getImageSourceError(photo.src))) return;
        return value;
    } catch { return; }
};

export const createNoteMutation = `mutation QuickFieldNote($relativePath: String!, $params: EntriesMutation!) {
    createEntries(relativePath: $relativePath, params: $params) { _sys { relativePath } }
}`;

export const findNoteQuery = `query FindFieldNote($relativePath: String!) {
    entries(relativePath: $relativePath) { title description date draft journalSection coverImage body }
}`;

// A lost save response must never cause a second entry or overwrite another document.
export async function saveFieldNote(
    request: <T>(query: string, options: { variables: Record<string, unknown> }) => Promise<T>,
    relativePath: string,
    params: ReturnType<typeof fieldNoteParams>,
) {
    try {
        await request(createNoteMutation, { variables: { relativePath, params } });
    } catch (saveError) {
        let existing: Record<string, unknown> | undefined;
        try {
            existing = (await request<{ entries: Record<string, unknown> }>(findNoteQuery, { variables: { relativePath } })).entries;
        } catch { /* Keep the original save failure if the read also fails. */ }
        const matches = existing && Object.entries(params).every(([key, value]) => {
            if (key === "date") return Date.parse(String(existing![key])) === Date.parse(value as string);
            if (key === "body") return String(existing![key] || "").trim() === String(value).trim();
            return existing![key] === value;
        });
        if (!matches) throw saveError;
    }
}
