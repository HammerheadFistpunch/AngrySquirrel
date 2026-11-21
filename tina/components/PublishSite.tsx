import React, { useCallback, useEffect, useState } from "react";

type PublishPhase =
    | "checking"
    | "current"
    | "pending"
    | "publishing"
    | "published"
    | "error";

interface PublishStatus {
    configured: boolean;
    latestCommit: string;
    branch: string;
    repository: string;
    activePublish?: {
        targetCommit: string;
        requestedAt: string;
        expiresAt: string;
    };
}

interface DeploymentStatus {
    commit: string;
    branch: string;
    builtAt: string;
}

const publishEndpoint = "/admin/api/publish";
const deploymentEndpoint = "/deployment.json";
const pollInterval = 15_000;

const shortCommit = (commit: string) =>
    commit && commit !== "local" ? commit.slice(0, 7) : commit;

const readJson = async <T,>(response: Response): Promise<T> => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        throw new Error(
            response.ok
                ? "The publish service returned an unexpected response."
                : "Publish access is unavailable. Sign in through /admin and try again.",
        );
    }

    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) {
        throw new Error(body.error || `Publish request failed (${response.status}).`);
    }

    return body;
};

const loadStatus = async () => {
    const [publishResponse, deploymentResponse] = await Promise.all([
        fetch(publishEndpoint, { cache: "no-store", credentials: "same-origin" }),
        fetch(deploymentEndpoint, { cache: "no-store" }),
    ]);

    return {
        publish: await readJson<PublishStatus>(publishResponse),
        deployment: await readJson<DeploymentStatus>(deploymentResponse),
    };
};

export const PublishSiteScreen = () => {
    const [phase, setPhase] = useState<PublishPhase>("checking");
    const [message, setMessage] = useState("Checking saved and deployed versions…");
    const [publishStatus, setPublishStatus] = useState<PublishStatus>();
    const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>();

    const refresh = useCallback(async (afterPublish = false) => {
        try {
            const { publish, deployment } = await loadStatus();
            setPublishStatus(publish);
            setDeploymentStatus(deployment);

            if (!publish.configured) {
                throw new Error("The publish service is not fully configured in Cloudflare.");
            }

            if (
                publish.activePublish &&
                deployment.commit === publish.activePublish.targetCommit
            ) {
                void fetch(publishEndpoint, {
                    method: "DELETE",
                    cache: "no-store",
                    credentials: "same-origin",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ targetCommit: deployment.commit }),
                });

                if (deployment.commit !== publish.latestCommit) {
                    setPhase("pending");
                    setMessage(
                        "The previous release is live, and newer saved changes are ready to publish.",
                    );
                    return;
                }
            }

            if (deployment.commit === publish.latestCommit) {
                setPhase(afterPublish ? "published" : "current");
                setMessage(
                    afterPublish
                        ? "The latest saved changes are now live."
                        : "No saved changes are waiting to be published.",
                );
                return;
            }

            if (publish.activePublish) {
                setPhase("publishing");
                setMessage(
                    `Cloudflare is publishing ${shortCommit(publish.activePublish.targetCommit)}. The current site stays live until the build succeeds.`,
                );
                return;
            }

            setPhase("pending");
            setMessage("Saved changes are ready to publish.");
        } catch (error) {
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Unable to check publish status.");
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        if (phase !== "publishing") return;
        const timer = window.setInterval(() => void refresh(true), pollInterval);
        return () => window.clearInterval(timer);
    }, [phase, refresh]);

    const publish = async () => {
        setPhase("publishing");
        setMessage("Requesting a Cloudflare production build…");

        try {
            const response = await fetch(publishEndpoint, {
                method: "POST",
                cache: "no-store",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: "{}",
            });
            const result = await readJson<{ targetCommit: string }>(response);
            setMessage(
                `Cloudflare accepted the build for ${shortCommit(result.targetCommit)}. The current site stays live until it succeeds.`,
            );
        } catch (error) {
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Unable to start publishing.");
        }
    };

    const clearStuckPublish = async () => {
        const targetCommit = publishStatus?.activePublish?.targetCommit;
        if (!targetCommit) return;
        if (!window.confirm(
            "Clear the publishing status? Check that Cloudflare has no active production build first. This does not cancel a build already running in Cloudflare.",
        )) return;

        setPhase("checking");
        setMessage("Clearing the previous publishing status…");
        try {
            const response = await fetch(publishEndpoint, {
                method: "DELETE",
                cache: "no-store",
                credentials: "same-origin",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ targetCommit }),
            });
            if (!response.ok) {
                throw new Error(`Could not clear publishing status (${response.status}).`);
            }
            await refresh();
        } catch (error) {
            setPhase("error");
            setMessage(error instanceof Error ? error.message : "Could not clear publishing status.");
        }
    };

    const canPublish = phase === "pending";
    const statusColor = phase === "error" ? "#c2410c" : phase === "current" || phase === "published" ? "#166534" : "#334155";

    return (
        <main style={{ margin: "0 auto", maxWidth: "52rem", padding: "3rem 2rem" }}>
            <p style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" }}>
                Site
            </p>
            <h1 style={{ fontSize: "2rem", margin: "0.4rem 0 0.75rem" }}>Publish Site</h1>
            <p style={{ color: "#475569", lineHeight: 1.6, maxWidth: "42rem" }}>
                Tina saves your edits to GitHub without rebuilding the public site. Publish once when the complete editing session is ready.
            </p>

            <section style={{ border: "1px solid #cbd5e1", borderRadius: "0.75rem", marginTop: "2rem", padding: "1.5rem" }}>
                <p aria-live="polite" style={{ color: statusColor, fontWeight: 700, margin: 0 }}>
                    {message}
                </p>

                {publishStatus && deploymentStatus && (
                    <dl style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "max-content 1fr", margin: "1.25rem 0", fontSize: "0.9rem" }}>
                        <dt style={{ color: "#64748b" }}>Saved</dt>
                        <dd style={{ margin: 0 }}><code>{shortCommit(publishStatus.latestCommit)}</code> on {publishStatus.branch}</dd>
                        <dt style={{ color: "#64748b" }}>Live</dt>
                        <dd style={{ margin: 0 }}><code>{shortCommit(deploymentStatus.commit)}</code></dd>
                    </dl>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.25rem" }}>
                    <button
                        type="button"
                        onClick={() => void publish()}
                        disabled={!canPublish}
                        style={{
                            background: canPublish ? "#2563eb" : "#94a3b8",
                            border: 0,
                            borderRadius: "0.45rem",
                            color: "white",
                            cursor: canPublish ? "pointer" : "not-allowed",
                            fontWeight: 700,
                            padding: "0.75rem 1rem",
                        }}
                    >
                        {phase === "publishing" ? "Publishing…" : "Publish Site"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        disabled={phase === "checking"}
                        style={{ background: "white", border: "1px solid #94a3b8", borderRadius: "0.45rem", cursor: "pointer", fontWeight: 700, padding: "0.75rem 1rem" }}
                    >
                        Check status
                    </button>
                    {phase === "publishing" && publishStatus?.activePublish && (
                        <button
                            type="button"
                            onClick={() => void clearStuckPublish()}
                            style={{ background: "white", border: "1px solid #94a3b8", borderRadius: "0.45rem", cursor: "pointer", fontWeight: 700, padding: "0.75rem 1rem" }}
                        >
                            Clear stuck status
                        </button>
                    )}
                </div>
            </section>

            {phase === "error" && (
                <p style={{ color: "#7c2d12", lineHeight: 1.6, marginTop: "1rem" }}>
                    The live site has not been replaced. Check Cloudflare Pages configuration or the most recent build, then use <strong>Check status</strong> before retrying.
                </p>
            )}
        </main>
    );
};
