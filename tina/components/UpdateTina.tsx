import React, { useEffect, useState } from "react";

const endpoint = "/admin/api/update-tina";
const messages = {
    idle: "Check for the latest TinaCMS, CLI, and Astro integration releases.",
    running: "Checking for updates and running validation…",
    current: "Tina is up to date as of the last check.",
    ready: "Update ready. Review and merge the pull request, then use Publish Site.",
    closed: "The update pull request has been closed. Use Publish Site when a merged update is ready to deploy.",
    failed: "The update failed. Open the workflow log for details.",
};

interface UpdateStatus {
    status: keyof typeof messages;
    runId?: number;
    runUrl?: string;
    prUrl?: string;
}

const requestStatus = async (path: string, method = "GET"): Promise<UpdateStatus> => {
    const response = await fetch(path, { method, cache: "no-store" });
    if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Tina update access is unavailable. Sign in at /admin/ and retry.");
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to check the Tina update.");
    return result;
};

export const UpdateTinaScreen = () => {
    const [update, setUpdate] = useState<UpdateStatus>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (busy || error || (update && !["running", "ready"].includes(update.status))) return;
        let cancelled = false;
        const path = update?.runId ? `${endpoint}?run=${update.runId}` : endpoint;
        const timer = window.setTimeout(async () => {
            try {
                const result = await requestStatus(path);
                if (!cancelled) setUpdate(result.status === "running" ? { ...result, runId: update?.runId } : result);
            } catch (cause) {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to check the Tina update.");
            }
        }, update ? 8_000 : 0);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [busy, error, update]);

    const start = async () => {
        setBusy(true);
        setError("");
        try {
            setUpdate(await requestStatus(endpoint, "POST"));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to start the Tina update.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <main style={{ maxWidth: "44rem", margin: "2rem auto", padding: "1rem" }}>
            <h1 style={{ fontSize: "2rem" }}>Update Tina</h1>
            <p role="status">{error || (update ? messages[update.status] : "Checking update status…")}</p>
            {error ? (
                <button type="button" className="tina-button" onClick={() => { setUpdate(undefined); setError(""); }}>
                    Refresh status
                </button>
            ) : (
                <button
                    type="button"
                    className="tina-button"
                    disabled={busy || !update || update.status === "running" || update.status === "ready"}
                    onClick={() => void start()}
                >
                    {busy ? "Starting…" : "Update Tina"}
                </button>
            )}
            {update?.prUrl && <p><a href={update.prUrl} target="_blank" rel="noreferrer">Open pull request</a></p>}
            {update?.runUrl && <p><a href={update.runUrl} target="_blank" rel="noreferrer">Open workflow log</a></p>}
        </main>
    );
};
