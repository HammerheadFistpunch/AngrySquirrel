import React from "react";
import type { CSSProperties, ChangeEvent, FocusEvent } from "react";
import { useCMS } from "tinacms";
import type { Media } from "tinacms";
import { marked } from "marked";
import ImmichImagePicker from "./ImmichImagePicker";
import { createMarkdownImage } from "../lib/immichMedia";
import { getYouTubeEmbedUrl } from "../lib/youtubeEmbed";
import {
    isSafeRelativeMarkdownImage,
    isSupportedImageSource,
} from "../../src/lib/image-sources";

type EditorMode = "write" | "split" | "preview";

interface MarkdownBodyFieldProps {
    input: {
        name: string;
        value: string;
        onChange: (event: ChangeEvent<string>) => void;
        onBlur: (event?: FocusEvent<string>) => void;
        onFocus: (event?: FocusEvent<string>) => void;
    };
    field: {
        label?: string | boolean;
        description?: string;
    };
    meta?: {
        error?: string;
        touched?: boolean;
    };
}

const allowedTags = new Set([
    "a", "blockquote", "br", "code", "del", "div", "em", "figcaption",
    "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "iframe",
    "img", "li", "ol", "p", "pre", "span", "strong", "table", "tbody",
    "td", "th", "thead", "tr", "ul",
]);
const blockedTags = new Set(["embed", "link", "meta", "object", "script", "style"]);

const safeUrl = (value: string, image = false) => {
    const normalized = value.trim();
    if (image) {
        if (isSupportedImageSource(normalized)) return normalized;
        if (isSafeRelativeMarkdownImage(normalized)) return normalized;
        return "";
    }
    if (/^(https?:\/\/|\/|\.\/|\.\.\/|#)/i.test(normalized)) return normalized;
    if (/^(mailto:|tel:)/i.test(normalized)) return normalized;
    return "";
};

const escapeHtml = (value: string) => value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const escapeMdxAttribute = (value: string) => value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");

const mdxAttribute = (source: string, name: string) => {
    const match = source.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
    return match?.[2]?.trim() || "";
};

const replaceYouTubeEmbeds = (markdown: string) => markdown.replace(
    /<YouTube\b([^>]*)\/>/g,
    (_match, attributes: string) => {
        const title = mdxAttribute(attributes, "title") || "YouTube video";
        const caption = mdxAttribute(attributes, "caption");
        const url = mdxAttribute(attributes, "url");
        const embedUrl = getYouTubeEmbedUrl(url);
        const detail = [url, caption].filter(Boolean).map(escapeHtml).join(" — ");

        if (embedUrl) {
            return [
                '<figure class="markdown-youtube-preview">',
                '<div class="markdown-youtube-frame">',
                `<iframe class="markdown-youtube-iframe" src="${escapeHtml(embedUrl)}" title="${escapeHtml(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
                "</div>",
                caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "",
                "</figure>",
            ].join("");
        }

        return [
            '<div class="markdown-youtube-preview">',
            `<strong>${escapeHtml(title)}</strong>`,
            detail ? `<span>${detail}</span>` : "",
            "</div>",
        ].join("");
    },
);

const unsupportedMdxComponents = (markdown: string) => Array.from(
    markdown.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g),
    (match) => match[1],
).filter((name, index, names) => name !== "YouTube" && names.indexOf(name) === index);

const unsafeMarkdownImages = (markdown: string) => Array.from(
    markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g),
    (match) => match[1],
).filter((source, index, sources) => !safeUrl(source, true) && sources.indexOf(source) === index);

const sanitizePreview = (html: string) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
        const tag = element.tagName.toLowerCase();
        if (blockedTags.has(tag)) {
            element.remove();
            continue;
        }
        if (!allowedTags.has(tag)) {
            element.replaceWith(...Array.from(element.childNodes));
            continue;
        }

        const originalAttributes = new Map(
            Array.from(element.attributes).map((attribute) => [attribute.name, attribute.value]),
        );
        for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);

        if (tag === "a") {
            const href = safeUrl(originalAttributes.get("href") || "");
            if (href) element.setAttribute("href", href);
            const title = originalAttributes.get("title");
            if (title) element.setAttribute("title", title);
            if (/^https?:\/\//i.test(href)) {
                element.setAttribute("target", "_blank");
                element.setAttribute("rel", "noopener noreferrer");
            }
        }

        if (tag === "img") {
            const src = safeUrl(originalAttributes.get("src") || "", true);
            if (!src) {
                element.remove();
                continue;
            }
            element.setAttribute("src", src);
            element.setAttribute("alt", originalAttributes.get("alt") || "");
            const title = originalAttributes.get("title");
            if (title) element.setAttribute("title", title);
        }

        if (tag === "iframe") {
            const src = getYouTubeEmbedUrl(originalAttributes.get("src") || "");
            if (!src) {
                element.remove();
                continue;
            }
            element.setAttribute("class", "markdown-youtube-iframe");
            element.setAttribute("src", src);
            element.setAttribute("title", originalAttributes.get("title") || "YouTube video");
            element.setAttribute("loading", "lazy");
            element.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
            element.setAttribute("allowfullscreen", "");
        }

        // Preserve semantic formatting without accepting arbitrary styles or attributes.
        if (tag === "ol") {
            const start = originalAttributes.get("start") || "";
            if (/^-?\d+$/.test(start)) element.setAttribute("start", start);
        }
        if (tag === "th" || tag === "td") {
            const align = originalAttributes.get("align") || "";
            if (/^(left|center|right)$/.test(align)) element.setAttribute("align", align);
        }

        if (tag === "code") {
            const className = originalAttributes.get("class") || "";
            if (/^language-[a-z0-9_-]+$/i.test(className)) element.setAttribute("class", className);
        }
        if (tag === "figure" && originalAttributes.get("class") === "markdown-youtube-preview") {
            element.setAttribute("class", "markdown-youtube-preview");
        }
        if (tag === "div" && originalAttributes.get("class") === "markdown-youtube-frame") {
            element.setAttribute("class", "markdown-youtube-frame");
        } else if (tag === "div" && originalAttributes.get("class") === "markdown-youtube-preview") {
            element.setAttribute("class", "markdown-youtube-preview");
        }
    }
    return document.body.innerHTML;
};

const renderPreview = (markdown: string) => {
    const prepared = replaceYouTubeEmbeds(markdown);
    const rendered = marked.parse(prepared, { async: false, gfm: true }) as string;
    return sanitizePreview(rendered);
};

const styles: Record<string, CSSProperties> = {
    editor: { width: "100%", maxWidth: "100%", minWidth: 0, containerType: "inline-size" },
    toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, marginBottom: 10 },
    toolbarSpacer: { flex: "1 1 16px" },
    toolDivider: { width: 1, alignSelf: "stretch", margin: "2px 3px", background: "#d1d5db" },
    button: {
        display: "grid", placeItems: "center", width: 34, height: 34, padding: 0,
        background: "#ffffff", border: "1px solid #d1d5db", borderRadius: 6,
        color: "#374151", cursor: "pointer", fontSize: 14, fontWeight: 700,
    },
    activeButton: { background: "#eff6ff", borderColor: "#2563eb", color: "#1d4ed8" },
    grid: { display: "grid", gap: 12, width: "100%", maxWidth: "100%", minWidth: 0 },
    pane: { minWidth: 0, maxWidth: "100%", overflow: "hidden" },
    paneLabel: {
        display: "block", marginBottom: 6, color: "#4b5563", fontSize: 12,
        fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
    },
    textarea: {
        width: "100%", height: 520, minHeight: 0, boxSizing: "border-box", padding: 16,
        border: "1px solid #d1d5db", borderRadius: 8, background: "#111827",
        color: "#f9fafb", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 16, lineHeight: 1.65, overflowY: "auto", resize: "none", tabSize: 4,
    },
    preview: {
        width: "100%", maxWidth: "100%", height: 520, minHeight: 0, boxSizing: "border-box",
        padding: 20, overflowX: "hidden", overflowY: "auto", overflowWrap: "anywhere",
        whiteSpace: "normal", wordBreak: "break-word", border: "1px solid #d1d5db",
        borderRadius: 8, background: "#ffffff", color: "#1f2937",
        fontFamily: "Georgia, Cambria, 'Times New Roman', serif", fontSize: 18, lineHeight: 1.7,
    },
    warning: {
        margin: "0 0 12px", padding: "10px 12px", border: "1px solid #f59e0b",
        borderRadius: 6, background: "#fffbeb", color: "#92400e", fontSize: 13, lineHeight: 1.45,
    },
    heading: { margin: "24px 0 4px", color: "#111827", fontSize: 16, fontWeight: 600 },
    help: { margin: "0 0 12px", color: "#6b7280", fontSize: 13, lineHeight: 1.5 },
    error: { margin: "8px 0 0", color: "#b91c1c", fontSize: 12 },
};

export default function MarkdownBodyField({ input, field, meta }: MarkdownBodyFieldProps) {
    const cms = useCMS();
    const [mode, setMode] = React.useState<EditorMode>("write");
    const markdown = typeof input.value === "string" ? input.value : "";
    const html = React.useMemo(() => renderPreview(markdown), [markdown]);
    const unsupported = React.useMemo(() => unsupportedMdxComponents(markdown), [markdown]);
    const unsafeImages = React.useMemo(() => unsafeMarkdownImages(markdown), [markdown]);
    const editorId = React.useId();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const showEditor = mode !== "preview";
    const showPreview = mode !== "write";

    const setMarkdown = React.useCallback((next: string, selectionStart?: number, selectionEnd?: number) => {
        input.onChange(next as unknown as ChangeEvent<string>);
        window.requestAnimationFrame(() => {
            const textarea = textareaRef.current;
            if (!textarea) return;
            textarea.focus();
            if (selectionStart !== undefined) {
                textarea.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
            }
        });
    }, [input]);

    const replaceSelection = React.useCallback((replacement: (selected: string) => string) => {
        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? markdown.length;
        const end = textarea?.selectionEnd ?? markdown.length;
        const selected = markdown.slice(start, end);
        const inserted = replacement(selected);
        const next = `${markdown.slice(0, start)}${inserted}${markdown.slice(end)}`;
        setMarkdown(next, start, start + inserted.length);
    }, [markdown, setMarkdown]);

    const wrap = (before: string, after = before, placeholder = "text") => {
        replaceSelection((selected) => `${before}${selected || placeholder}${after}`);
    };

    const transformLines = (numbered = false) => {
        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? markdown.length;
        const end = textarea?.selectionEnd ?? markdown.length;
        const selected = markdown.slice(start, end);
        const source = selected || "List item";
        const items = source
            .split("\n")
            .map((line) => line.replace(/^\s*(?:[-*+] |\d+\. )/, "").trim())
            .filter(Boolean);
        const list = items.map((line, index) =>
            `${numbered ? `${index + 1}.` : "-"} ${line}`
        ).join("\n");
        const before = markdown.slice(0, start);
        const after = markdown.slice(end);
        const leading = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
        const trailing = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
        const inserted = `${leading}${list}${trailing}`;
        const next = `${before}${inserted}${after}`;
        setMarkdown(next, start + leading.length, start + leading.length + list.length);
    };

    const insertHardBreak = () => {
        replaceSelection((selected) => selected
            ? selected.replace(/[ \t]*\n/g, "  \n")
            : "  \n");
    };

    const insertLink = () => {
        const textarea = textareaRef.current;
        const selected = textarea
            ? markdown.slice(textarea.selectionStart, textarea.selectionEnd)
            : "";
        const url = window.prompt("Link URL", "https://");
        if (!url) return;
        replaceSelection(() => `[${selected || "link text"}](${url.trim()})`);
    };

    const insertImage = (source: string) => {
        if (!source) return;
        const alt = window.prompt("Image alt text", "") ?? "";
        replaceSelection(() => createMarkdownImage(source, alt));
    };

    const insertImageUrl = () => {
        const url = window.prompt("Image URL", "https://");
        if (!url) return;
        insertImage(url);
    };

    const insertManagedImage = () => {
        cms.media.open({
            allowDelete: true,
            onSelect: (media: Media) => {
                const source = cms.media.store.parse?.(media) || media.src || "";
                if (source) insertImage(source);
            },
        });
    };

    const insertYouTube = () => {
        const url = window.prompt("YouTube URL", "https://www.youtube.com/watch?v=");
        if (!url) return;
        const title = window.prompt("Accessible video title", "YouTube video") || "YouTube video";
        const caption = window.prompt("Caption (optional)", "") || "";
        const captionAttribute = caption ? ` caption="${escapeMdxAttribute(caption)}"` : "";
        replaceSelection(() => `<YouTube url="${escapeMdxAttribute(url)}" title="${escapeMdxAttribute(title)}"${captionAttribute} />`);
    };

    return (
        <div style={styles.editor}>
            <div style={styles.heading}>
                {typeof field.label === "string" ? field.label : "Entry Content (Markdown)"}
            </div>
            {field.description && <p style={styles.help}>{field.description}</p>}

            <div className="markdown-editor-toolbar" style={styles.toolbar} role="toolbar" aria-label="Markdown editor toolbar">
                <button type="button" style={styles.button} aria-label="Bold" title="Bold" onClick={() => wrap("**")}>B</button>
                <button type="button" style={{ ...styles.button, fontStyle: "italic" }} aria-label="Italic" title="Italic" onClick={() => wrap("*")}>I</button>
                <button type="button" style={{ ...styles.button, textDecoration: "line-through" }} aria-label="Strikethrough" title="Strikethrough" onClick={() => wrap("~~")}>S</button>
                <button type="button" style={{ ...styles.button, fontSize: 11 }} aria-label="Inline code" title="Inline code" onClick={() => wrap("`", "`", "code")}>&lt;/&gt;</button>
                <span style={styles.toolDivider} aria-hidden="true" />
                <button type="button" style={styles.button} aria-label="Bulleted list" title="Bulleted list" onClick={() => transformLines(false)}>•≡</button>
                <button type="button" style={{ ...styles.button, fontSize: 12 }} aria-label="Numbered list" title="Numbered list" onClick={() => transformLines(true)}>1.</button>
                <button type="button" style={styles.button} aria-label="Insert line break" title="Line break" onClick={insertHardBreak}>↵</button>
                <button type="button" style={styles.button} aria-label="Insert link" title="Insert link" onClick={insertLink}>↗</button>
                <span style={styles.toolDivider} aria-hidden="true" />
                <button type="button" style={styles.button} aria-label="Insert Media Manager image" title="Media Manager image" onClick={insertManagedImage}>▣</button>
                <ImmichImagePicker compact buttonLabel="Insert Immich image" onSelect={(url) => insertImage(url)} />
                <button type="button" style={styles.button} aria-label="Insert image URL" title="Image URL" onClick={insertImageUrl}>⌁</button>
                <button type="button" style={styles.button} aria-label="Insert YouTube video" title="YouTube" onClick={insertYouTube}>▶</button>
                <span style={styles.toolbarSpacer} aria-hidden="true" />
                {(["write", "split", "preview"] as EditorMode[]).map((option) => (
                    <button
                        key={option}
                        type="button"
                        className={option === "split" ? "markdown-editor-split-toggle" : undefined}
                        aria-pressed={mode === option}
                        aria-label={`${option[0].toUpperCase() + option.slice(1)} view`}
                        title={`${option[0].toUpperCase() + option.slice(1)} view`}
                        style={{ ...styles.button, ...(mode === option ? styles.activeButton : {}) }}
                        onClick={() => setMode(option)}
                    >
                        {option === "write" ? "✎" : option === "split" ? "◫" : "◉"}
                    </button>
                ))}
            </div>

            {unsupported.length > 0 && (
                <p role="alert" style={styles.warning}>
                    Preview skipped unsupported MDX component{unsupported.length === 1 ? "" : "s"}: {unsupported.join(", ")}.
                    The source remains unchanged; remove or replace the component before publishing.
                </p>
            )}

            {unsafeImages.length > 0 && (
                <p role="alert" style={styles.warning}>
                    Preview omitted unsafe image source{unsafeImages.length === 1 ? "" : "s"}: {unsafeImages.join(", ")}.
                    Use a managed /uploads path, a relative Markdown path, or a complete HTTPS image URL.
                </p>
            )}

            <div
                className="markdown-body-editor-grid"
                data-mode={mode}
                style={{
                    ...styles.grid,
                    gridTemplateColumns: mode === "split" ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
                }}
            >
                {showEditor && (
                    <div style={styles.pane}>
                        <label htmlFor={editorId} style={styles.paneLabel}>Markdown source</label>
                        <textarea
                            ref={textareaRef}
                            id={editorId}
                            name={input.name}
                            value={markdown}
                            style={styles.textarea}
                            spellCheck
                            onChange={(event) => input.onChange(event.target.value as unknown as ChangeEvent<string>)}
                            onBlur={() => input.onBlur?.()}
                            onFocus={() => input.onFocus?.()}
                        />
                    </div>
                )}

                {showPreview && (
                    <div style={styles.pane}>
                        <span style={styles.paneLabel}>Sanitized preview</span>
                        <div
                            style={styles.preview}
                            className="markdown-body-preview"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    </div>
                )}
            </div>

            <style>{`
                @container (max-width: 44rem) {
                    .markdown-body-editor-grid[data-mode="split"] {
                        grid-template-columns: minmax(0, 1fr) !important;
                    }
                    .markdown-editor-split-toggle { display: none !important; }
                    .markdown-editor-toolbar { gap: 5px !important; }
                    .markdown-editor-toolbar button { min-width: 38px; min-height: 38px; }
                    .markdown-body-editor-grid textarea,
                    .markdown-body-editor-grid .markdown-body-preview {
                        height: 60vh !important;
                        min-height: 0 !important;
                    }
                }
                .markdown-body-preview { min-width: 0; white-space: normal !important; }
                .markdown-body-preview > :first-child { margin-top: 0; }
                .markdown-body-preview > :last-child { margin-bottom: 0; }
                .markdown-body-preview p,
                .markdown-body-preview li,
                .markdown-body-preview h1,
                .markdown-body-preview h2,
                .markdown-body-preview h3,
                .markdown-body-preview h4,
                .markdown-body-preview h5,
                .markdown-body-preview h6,
                .markdown-body-preview a,
                .markdown-body-preview blockquote,
                .markdown-body-preview figcaption,
                .markdown-body-preview code { overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
                /* Tina's reset removes native Markdown typography. Keep these rules
                   scoped to the preview so admin and public-site styles stay independent. */
                .markdown-body-preview :is(p, li, blockquote, th, td) {
                    font-size: inherit; line-height: inherit; color: inherit;
                }
                .markdown-body-preview p { margin: 0 0 1em; }
                .markdown-body-preview :is(h1, h2, h3, h4, h5, h6) {
                    font-family: inherit; font-weight: 700; line-height: 1.3;
                    letter-spacing: normal; color: #111827; margin: 1.25em 0 0.5em;
                }
                .markdown-body-preview h1 { font-size: 1.6em; }
                .markdown-body-preview h2 { font-size: 1.4em; }
                .markdown-body-preview h3 { font-size: 1.2em; }
                .markdown-body-preview h4 { font-size: 1.1em; }
                .markdown-body-preview h5 { font-size: 1em; }
                .markdown-body-preview h6 { font-size: 0.95em; }
                .markdown-body-preview strong { font-weight: 700; }
                .markdown-body-preview em { font-style: italic; }
                .markdown-body-preview del { text-decoration: line-through; }
                .markdown-body-preview :is(ul, ol) { margin: 0 0 1em; padding-left: 1.75em; list-style-position: outside; }
                .markdown-body-preview ul { list-style-type: disc; }
                .markdown-body-preview ol { list-style-type: decimal; }
                .markdown-body-preview ul ul { list-style-type: circle; }
                .markdown-body-preview ul ul ul { list-style-type: square; }
                .markdown-body-preview li { display: list-item; margin: 0.3em 0; }
                .markdown-body-preview li > :is(ul, ol) { margin: 0.3em 0; }
                .markdown-body-preview li > p { margin: 0.3em 0; }
                .markdown-body-preview hr { border: 0; border-top: 1px solid #d1d5db; margin: 1.5em 0; }
                .markdown-body-preview a { color: #2563eb; text-decoration: underline; }
                .markdown-body-preview img { display: block; width: auto; max-width: 100%; height: auto; object-fit: contain; margin: 1rem 0; border-radius: 6px; }
                .markdown-body-preview blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 4px solid #9ca3af; color: #4b5563; }
                .markdown-body-preview pre { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: auto; padding: 1rem; border-radius: 6px; background: #111827; color: #f9fafb; }
                .markdown-body-preview code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9em; background: #f3f4f6; padding: 0.15em 0.3em; border-radius: 3px; }
                .markdown-body-preview pre code { overflow-wrap: normal; word-break: normal; white-space: pre; background: transparent; padding: 0; color: inherit; }
                .markdown-body-preview table { display: block; width: 100%; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
                .markdown-body-preview th,
                .markdown-body-preview td { padding: 0.5rem; border: 1px solid #d1d5db; text-align: left; }
                .markdown-body-preview th { font-weight: 700; background: #f3f4f6; }
                .markdown-body-preview :is(th, td)[align="center"] { text-align: center; }
                .markdown-body-preview :is(th, td)[align="right"] { text-align: right; }
                .markdown-body-preview .markdown-youtube-preview { display: grid; gap: 0.5rem; width: 100%; max-width: 100%; margin: 1rem 0; font-family: ui-sans-serif, system-ui, sans-serif; }
                .markdown-body-preview div.markdown-youtube-preview { box-sizing: border-box; padding: 1rem; border: 1px solid #93c5fd; border-radius: 6px; background: #eff6ff; }
                .markdown-body-preview .markdown-youtube-preview span,
                .markdown-body-preview .markdown-youtube-preview figcaption { color: #4b5563; font-size: 0.875rem; }
                .markdown-body-preview .markdown-youtube-frame { position: relative; width: 100%; max-width: 100%; overflow: hidden; aspect-ratio: 16 / 9; border-radius: 6px; background: #000; }
                .markdown-body-preview .markdown-youtube-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
            `}</style>

            {meta?.touched && meta.error && (
                <p role="alert" style={styles.error}>{meta.error}</p>
            )}
        </div>
    );
}
