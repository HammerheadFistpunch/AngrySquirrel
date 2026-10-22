import assert from "node:assert/strict";
import test from "node:test";
import { compile } from "@mdx-js/mdx";
import { fieldNoteParams, fieldNotePath, newFieldNote, noteMarkdown, readStoredNote, saveFieldNote, createNoteMutation } from "../tina/lib/fieldNote.ts";

test("a short note supplies Journal metadata and preserves draft/public choices", () => {
    const entry = { ...newFieldNote(), note: "  A moment on the trail.\n\nAnother thought.  " };
    const params = fieldNoteParams(entry, true);
    assert.equal(params.title, "A moment on the trail.");
    assert.equal(params.description, "A moment on the trail. Another thought.");
    assert.equal(params.journalSection, "field-notes");
    assert.equal(params.draft, true);
    assert.equal(fieldNoteParams(entry, false).draft, false);
    assert.equal(fieldNoteParams({ ...entry, title: "My title" }, true).title, "My title");
    assert.equal(fieldNotePath(entry), fieldNotePath(entry));
    assert.notEqual(fieldNotePath(entry), fieldNotePath(newFieldNote()));
    assert.throws(() => fieldNoteParams({ ...entry, note: " " }, true), /Write a note/);
    assert.throws(() => fieldNoteParams(entry, true, ""), /unavailable/);
});

test("dictated text containing MDX syntax compiles as literal text", async () => {
    const text = 'We got <3 miles. {altitude} was 8,000.\n\nimport map from "somewhere"\n\n<script>alert("hi")</script>\n\n- a thought\n\n1. another\n\n![not a photo](javascript:alert(1))';
    const body = noteMarkdown(text);
    const compiled = String(await compile(body));
    assert.doesNotMatch(compiled, /^import map from/m);
    assert.doesNotMatch(compiled, /_components\.script|_components\.img|_components\.ul|_components\.ol/);
    assert.match(body, /\\\{altitude\\\}/);
    assert.match(body, /\\<script\\>/);
});

test("photos become portable body images, with the first used as cover", async () => {
    const entry = { ...newFieldNote(), note: "Trail update", photos: [
        { src: "/uploads/cover.jpg", alt: "" },
        { src: "/uploads/a (1).jpg", alt: "Creek [crossing]" },
        { src: "https://media.angrysquirrel.org/b.jpg", alt: "" },
    ] };
    const params = fieldNoteParams(entry, false);
    assert.equal(params.coverImage, "/uploads/cover.jpg");
    assert.doesNotMatch(params.body, /cover\.jpg/);
    assert.match(params.body, /a%20%281%29\.jpg/);
    assert.match(params.body, /!\[\]\(https:\/\/media/);
    await compile(params.body);
    assert.throws(() => fieldNoteParams({ ...entry, photos: [{ src: "javascript:bad", alt: "" }] }, false), /unsupported/);
});

test("local backup restores complete notes and rejects corrupt or unsafe backups", () => {
    const entry = { ...newFieldNote(), note: "Saved on my phone", photos: [{ src: "/uploads/a.jpg", alt: "Sunset" }] };
    assert.deepEqual(readStoredNote(JSON.stringify(entry)), entry);
    for (const value of [null, "invalid JSON", "{}", JSON.stringify({ ...entry, id: "../../other" }), JSON.stringify({ ...entry, photos: [null] })]) {
        assert.equal(readStoredNote(value), undefined);
    }
});

test("a lost save response recovers the same note without creating a duplicate", async () => {
    const entry = { ...newFieldNote(), note: "One note" };
    const params = fieldNoteParams(entry, false);
    const calls = [];
    await saveFieldNote(async (query, options) => {
        calls.push(options.variables.relativePath);
        if (query === createNoteMutation) throw new Error("Lost response");
        return { entries: { ...params, body: params.body + "\n" } };
    }, fieldNotePath(entry), params);
    assert.deepEqual(calls, [fieldNotePath(entry), fieldNotePath(entry)]);
    await assert.rejects(saveFieldNote(async (query) => {
        if (query === createNoteMutation) throw new Error("Save failed");
        return { entries: { ...params, body: "Different existing text" } };
    }, fieldNotePath(entry), params), /Save failed/);
});
