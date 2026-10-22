import React from "react";
import { useCMS } from "tinacms";
import type { Media } from "tinacms";
import { fieldNoteParams, fieldNotePath, newFieldNote, readStoredNote, saveFieldNote } from "../lib/fieldNote";
import type { FieldNote, NotePhoto } from "../lib/fieldNote";
import { getImageSourceError } from "../../src/lib/image-sources";

const storageKey = "angrysquirrel.quick-field-note.v1";
const registryQuery = `query QuickNoteSection {
    journalSectionsConnection(first: 100) { edges { node { slug active } } }
}`;

// Resize and re-encode before upload: smaller mobile uploads and no camera GPS metadata.
async function preparePhoto(file: File): Promise<File> {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) throw new Error("Choose a JPEG, PNG, WebP, or supported HEIC photo.");
    if (file.size > 30_000_000) throw new Error("Choose a photo smaller than 30 MB.");
    const image = new Image();
    const url = URL.createObjectURL(file);
    try {
        image.src = url;
        await image.decode();
        const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Photo processing is unavailable in this browser.");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
            (result) => result ? resolve(result) : reject(new Error("Photo processing failed.")), "image/jpeg", 0.85,
        ));
        return new File([blob], `field-note-${crypto.randomUUID()}.jpg`, { type: "image/jpeg" });
    } catch (error) {
        throw new Error(`Could not prepare ${file.name}. Try a JPEG photo. ${error instanceof Error ? error.message : ""}`);
    } finally { URL.revokeObjectURL(url); }
}

export const FieldNoteScreen = () => {
    const cms = useCMS();
    const [entry, setEntry] = React.useState<FieldNote>(newFieldNote);
    const [ready, setReady] = React.useState(false);
    const [section, setSection] = React.useState("");
    const [sectionError, setSectionError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const busyRef = React.useRef(false);
    const [message, setMessage] = React.useState("");
    const [error, setError] = React.useState("");
    const [storageWarning, setStorageWarning] = React.useState("");
    const [saved, setSaved] = React.useState<{ draft: boolean; path: string; publishing: boolean }>();

    React.useEffect(() => {
        try {
            const restored = readStoredNote(localStorage.getItem(storageKey));
            if (restored) setEntry(restored);
        } catch { setStorageWarning("This browser cannot keep a local backup. Keep this screen open until you save."); }
        setReady(true);
        let mounted = true;
        const api = cms.api.tina;
        if (!api) setSectionError("The editor connection is unavailable. Reload and sign in again.");
        else api.request<{ journalSectionsConnection: { edges?: Array<{ node?: { slug: string; active?: boolean } }> } }>(registryQuery, { variables: {} })
            .then((result) => {
                if (!mounted) return;
                const found = result.journalSectionsConnection.edges?.some(({ node }) => node?.slug === "field-notes" && node.active !== false);
                if (found) setSection("field-notes");
                else setSectionError("Activate the Field Notes section under Content → Journal Sections, then reload.");
            }).catch(() => { if (mounted) setSectionError("Could not load Field Notes. Reload and sign in again."); });
        return () => { mounted = false; };
    }, [cms]);

    React.useEffect(() => {
        if (!ready || saved) return;
        try { localStorage.setItem(storageKey, JSON.stringify(entry)); }
        catch { setStorageWarning("This browser cannot keep a local backup. Keep this screen open until you save."); }
    }, [entry, ready, saved]);

    const lock = () => {
        if (busyRef.current) return false;
        busyRef.current = true; setBusy(true); setError(""); return true;
    };
    const unlock = () => { busyRef.current = false; setBusy(false); };
    const patch = (values: Partial<FieldNote>) => setEntry((current) => ({ ...current, ...values }));

    const addPhoto = (media: Media) => {
        const src = String(cms.media.store.parse?.(media) || media.src || "");
        if (!src || getImageSourceError(src)) throw new Error("The photo upload did not return a supported image address.");
        setEntry((current) => ({ ...current, photos: [...current.photos, { src, alt: "" }] }));
    };

    const upload = async (files: File[]) => {
        if (!files.length || !lock()) return;
        try {
            if (entry.photos.length + files.length > 6) throw new Error("Add up to six photos per note.");
            for (let index = 0; index < files.length; index++) {
                setMessage(`Preparing photo ${index + 1} of ${files.length}…`);
                const file = await preparePhoto(files[index]);
                setMessage(`Uploading photo ${index + 1} of ${files.length}…`);
                const [media] = await cms.media.persist([{ directory: "", file }]);
                if (!media) throw new Error("The upload did not return a photo. Try again.");
                addPhoto(media);
            }
            setMessage("Photos added. The first photo is the cover.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Photo upload failed. Try again."); }
        finally { unlock(); }
    };

    const publish = async () => {
        const response = await fetch("/admin/api/publish", {
            method: "POST", credentials: "same-origin", cache: "no-store",
            headers: { "content-type": "application/json" }, body: "{}",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "The build could not be requested. Sign in through /admin and retry.");
        setSaved((current) => current && ({ ...current, publishing: true }));
        setMessage("Note saved. The site build has been requested; it will appear after the build succeeds.");
    };

    const save = async (draft: boolean) => {
        if (!lock()) return;
        try {
            const api = cms.api.tina;
            if (!api) throw new Error("Sign in to the editor and try again.");
            const params = fieldNoteParams(entry, draft, section);
            const path = fieldNotePath(entry);
            setMessage("Saving your note…");
            await saveFieldNote((query, options) => api.request(query, options), path, params);
            setSaved({ path, draft, publishing: false });
            try { localStorage.removeItem(storageKey); } catch { /* Saving to Tina already succeeded. */ }
            setMessage(draft ? "Draft saved. You can finish it in Journal." : "Note saved. Requesting the site build…");
            if (!draft) await publish();
        } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save. Your note is still here."); }
        finally { unlock(); }
    };

    const retryPublish = async () => {
        if (!lock()) return;
        try { await publish(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Could not request the build. Your note is saved."); }
        finally { unlock(); }
    };

    const changePhoto = (index: number, values: Partial<NotePhoto>) => setEntry((current) => ({
        ...current, photos: current.photos.map((photo, position) => position === index ? { ...photo, ...values } : photo),
    }));

    return <main className="quick-note">
        <style>{`
            .quick-note { box-sizing: border-box; max-width: 640px; margin: 0 auto; padding: 24px 16px calc(24px + env(safe-area-inset-bottom)); color: #1f2937; }
            .quick-note * { box-sizing: border-box; }
            .quick-note h1 { font-size: 26px; line-height: 1.2; margin: 8px 0; }
            .quick-note p { line-height: 1.5; }
            .quick-note .muted { color: #64748b; font-size: 14px; }
            .quick-note label { display: block; font-weight: 600; margin: 16px 0 8px; }
            .quick-note input:not([type=file]), .quick-note textarea { width: 100%; font: inherit; font-size: 16px; padding: 12px; border: 1px solid #94a3b8; border-radius: 10px; background: white; color: #111827; }
            .quick-note textarea { min-height: 240px; line-height: 1.6; resize: vertical; }
            .quick-note button, .quick-note .photo-button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 10px 16px; border: 1px solid #94a3b8; border-radius: 10px; background: white; color: #1f2937; cursor: pointer; font: inherit; font-weight: 600; text-decoration: none; margin: 0; }
            .quick-note button:disabled { opacity: .5; cursor: default; }
            .quick-note .primary { color: white; background: #2563eb; border-color: #2563eb; }
            .quick-note .photo-picker { position: relative; overflow: hidden; }
            .quick-note .photo-picker input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
            .quick-note .photo-picker:focus-within { outline: 3px solid #2563eb; outline-offset: 3px; }
            .quick-note .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }
            .quick-note .actions button { flex: 1; }
            .quick-note .photo { padding: 12px; margin-top: 16px; border: 1px solid #cbd5e1; border-radius: 12px; }
            .quick-note .photo img { display: block; width: 100%; max-height: 220px; object-fit: contain; }
            .quick-note .error { color: #b91c1c; }
            .quick-note fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
            .quick-note details { margin: 20px 0; }
            .quick-note summary { cursor: pointer; padding: 12px 0; }
            .quick-note :focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
        `}</style>
        <p className="muted">Journal / Field Notes</p>
        <h1>Quick Field Note</h1>
        <p className="muted">A few words, a photo, a moment worth keeping.</p>
        {!saved ? <>
            <fieldset disabled={busy || !ready}>
                <label htmlFor="quick-note-text">Your note</label>
                <textarea id="quick-note-text" value={entry.note} placeholder="What caught your attention?" onChange={(event) => patch({ note: event.target.value })} />
                <p className="muted">Type or use your keyboard’s microphone to dictate.</p>
                <label className="photo-button photo-picker">＋ Add photos
                    <input aria-label="Add photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple
                        onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} />
                </label>
                {entry.photos.map((photo, index) => <div className="photo" key={`${index}-${photo.src}`}>
                    <img src={photo.src} alt={photo.alt || `Selected photo ${index + 1}`} />
                    {index === 0 ? <p className="muted">Cover photo</p> : <>
                        <label htmlFor={`photo-alt-${index}`}>Photo description (optional)</label>
                        <input id={`photo-alt-${index}`} value={photo.alt} onChange={(event) => changePhoto(index, { alt: event.target.value })} />
                    </>}
                    <button type="button" style={{ marginTop: 10 }} onClick={() => patch({ photos: entry.photos.filter((_, position) => position !== index) })}>Remove photo</button>
                </div>)}
                <details><summary>More options</summary>
                    <label htmlFor="quick-note-title">Title (optional)</label>
                    <input id="quick-note-title" value={entry.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Use the opening line" />
                </details>
                <div className="actions">
                    <button className="primary" type="button" disabled={!section || !entry.note.trim()} onClick={() => void save(false)}>Publish</button>
                    <button type="button" disabled={!section || !entry.note.trim()} onClick={() => void save(true)}>Save Draft</button>
                </div>
            </fieldset>
            <p className="muted">Date, title, and summary are filled automatically. Publish also releases other saved site changes.</p>
            {!section && <p className={sectionError ? "error" : "muted"} role="status">{sectionError || "Connecting to Field Notes…"}</p>}
        </> : <>
            <div className="actions">
                {!saved.draft && !saved.publishing && <button className="primary" disabled={busy} type="button" onClick={() => void retryPublish()}>Retry publishing</button>}
                <a className="photo-button" href={`#/collections/edit/entries/~/${saved.path.replace(/\.mdx$/, "")}`}>Edit in Journal</a>
                <button type="button" disabled={busy} onClick={() => { setEntry(newFieldNote()); setSaved(undefined); setMessage(""); setError(""); }}>New note</button>
            </div>
            {!saved.draft && <p><a href="#/screens/publish_site">Check publishing status</a></p>}
        </>}
        <p role="status" aria-live="polite">{message}</p>
        {error && <p className="error" role="alert">{saved ? "Your note is saved. " : ""}{error}</p>}
        {storageWarning && !saved && <p className="error">{storageWarning}</p>}
    </main>;
};
