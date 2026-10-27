import cloudflareAccessPlugin from "@cloudflare/pages-plugin-cloudflare-access";
import { getPublishPolicyError } from "../../../src/server/publish-policy.js";

const jsonHeaders = {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
};

const json = (body, init = {}) =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: { ...jsonHeaders, ...init.headers },
    });

const getConfiguration = (env) => ({
    accessDomain: env.CLOUDFLARE_ACCESS_DOMAIN,
    accessAudience: env.CLOUDFLARE_ACCESS_AUD,
    allowedEmail: env.PUBLISH_ALLOWED_EMAIL?.trim().toLowerCase(),
    deployHook: env.CLOUDFLARE_DEPLOY_HOOK_URL,
    repository: env.PUBLISH_GITHUB_REPOSITORY || "HammerheadFistpunch/GTP_Port",
    branch: env.PUBLISH_GITHUB_BRANCH || "main",
    state: env.PUBLISH_STATE,
});

const loadLatestCommit = async (repository, branch) => {
    const response = await fetch(
        `https://api.github.com/repos/${repository}/commits/${encodeURIComponent(branch)}`,
        {
            headers: {
                accept: "application/vnd.github+json",
                "user-agent": "angrysquirrel-publish-relay",
                "x-github-api-version": "2022-11-28",
            },
        },
    );

    if (!response.ok) {
        throw new Error(`GitHub returned ${response.status} while checking saved changes.`);
    }

    const result = await response.json();
    if (!/^[a-f0-9]{40}$/i.test(result.sha || "")) {
        throw new Error("GitHub did not return a valid commit identifier.");
    }

    return result.sha;
};

const readPublishState = async (state) => {
    const active = await state.get("active-publish", "json");
    if (!active || Date.parse(active.expiresAt) <= Date.now()) {
        if (active) await state.delete("active-publish");
        return undefined;
    }
    return active;
};

const authenticate = async (context) => {
    const config = getConfiguration(context.env);
    if (!config.accessDomain || !config.accessAudience) {
        return json(
            { error: "Cloudflare Access is not configured for publishing." },
            { status: 503 },
        );
    }

    return cloudflareAccessPlugin({
        domain: config.accessDomain,
        aud: config.accessAudience,
    })(context);
};

const handlePublishRequest = async (context) => {
    const config = getConfiguration(context.env);
    const email = context.data.cloudflareAccess?.JWT?.payload?.email?.toLowerCase();

    if (!config.allowedEmail || email !== config.allowedEmail) {
        return json({ error: "This identity is not allowed to publish the site." }, { status: 403 });
    }

    if (!config.deployHook || !config.state) {
        return json(
            {
                configured: false,
                error: "The deploy hook or publish-state binding is missing.",
            },
            { status: 503 },
        );
    }

    if (context.request.method === "GET") {
        try {
            const [latestCommit, activePublish] = await Promise.all([
                loadLatestCommit(config.repository, config.branch),
                readPublishState(config.state),
            ]);
            return json({
                configured: true,
                repository: config.repository,
                branch: config.branch,
                latestCommit,
                activePublish,
            });
        } catch (error) {
            return json(
                { error: error instanceof Error ? error.message : "Unable to check publish status." },
                { status: 502 },
            );
        }
    }

    if (context.request.method === "DELETE") {
        const body = await context.request.json().catch(() => ({}));
        const activePublish = await readPublishState(config.state);
        if (activePublish?.targetCommit === body.targetCommit) {
            await config.state.delete("active-publish");
        }
        return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }

    if (context.request.method !== "POST") {
        return json({ error: "Method not allowed." }, { status: 405, headers: { allow: "GET, POST, DELETE" } });
    }

    const activePublish = await readPublishState(config.state);
    if (activePublish) {
        return json(
            { error: "A publish build is already in progress.", activePublish },
            { status: 409 },
        );
    }

    try {
        const targetCommit = await loadLatestCommit(config.repository, config.branch);
        const requestedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const publishState = { targetCommit, requestedAt, expiresAt, requestedBy: email };

        await config.state.put("active-publish", JSON.stringify(publishState), {
            expirationTtl: 15 * 60,
        });

        const hookResponse = await fetch(config.deployHook, { method: "POST" });
        if (!hookResponse.ok) {
            await config.state.delete("active-publish");
            return json(
                { error: `Cloudflare rejected the publish request (${hookResponse.status}).` },
                { status: 502 },
            );
        }

        return json({ accepted: true, targetCommit, requestedAt }, { status: 202 });
    } catch (error) {
        await config.state.delete("active-publish");
        return json(
            { error: error instanceof Error ? error.message : "Unable to start publishing." },
            { status: 502 },
        );
    }
};

const enforceProduction = (context) => {
    const error = getPublishPolicyError(context.request.url, context.env);
    if (error) return json({ configured: false, error }, { status: 403 });
    return context.next();
};

export const onRequest = [enforceProduction, authenticate, handlePublishRequest];
