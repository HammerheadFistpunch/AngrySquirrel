import cloudflareAccessPlugin from "@cloudflare/pages-plugin-cloudflare-access";
import { getPublishPolicyError } from "../../../src/server/publish-policy.js";

const repository = "HammerheadFistpunch/AngrySquirrel";
const workflow = "update-tina.yml";
const apiBase = `https://api.github.com/repos/${repository}`;
const json = (body, status = 200) => Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
});

const authenticate = (context) => {
    const error = getPublishPolicyError(context.request.url, context.env);
    if (error) return json({ error: "Tina updates are available from the production CMS." }, 403);
    const { CLOUDFLARE_ACCESS_DOMAIN: domain, CLOUDFLARE_ACCESS_AUD: aud } = context.env;
    if (!domain || !aud) return json({ error: "Cloudflare Access is required." }, 503);
    return cloudflareAccessPlugin({ domain, aud })(context);
};

const github = async (token, path, body) => {
    const response = await fetch(`${apiBase}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "user-agent": "angrysquirrel-tina-update",
            "x-github-api-version": "2026-03-10",
        },
        body: body && JSON.stringify(body),
        redirect: "error",
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}.`);
    return response.json();
};

const getStatus = async (token, runId) => {
    const workflowPath = `/actions/workflows/${workflow}`;
    const run = runId
        ? await github(token, `/actions/runs/${runId}`)
        : (await github(token, `${workflowPath}/runs?branch=main&event=workflow_dispatch&per_page=1`)).workflow_runs[0];
    if (!run) return { status: "idle" };
    if (run.path?.split("@")[0] !== `.github/workflows/${workflow}` || run.head_branch !== "main" || run.event !== "workflow_dispatch") {
        return { status: "idle" };
    }

    const runUrl = `https://github.com/${repository}/actions/runs/${run.id}`;
    if (run.status !== "completed") return { status: "running", runUrl };
    if (run.conclusion !== "success") return { status: "failed", runUrl };

    const branch = `maintenance/tina-update-${run.id}-${run.run_attempt}`;
    const pulls = await github(token, `/pulls?state=all&base=main&head=${encodeURIComponent(`HammerheadFistpunch:${branch}`)}`);
    const pull = pulls[0];
    if (!pull) return { status: "current", runUrl };
    const prUrl = `https://github.com/${repository}/pull/${pull.number}`;
    return { status: pull.state === "open" ? "ready" : "closed", runUrl, prUrl };
};

const handleRequest = async ({ request, env, data }) => {
    const email = data.cloudflareAccess?.JWT?.payload?.email?.toLowerCase();
    if (!email || email !== env.PUBLISH_ALLOWED_EMAIL?.trim().toLowerCase()) {
        return json({ error: "This account cannot update Tina." }, 403);
    }
    const token = env.TINA_UPDATE_GITHUB_TOKEN;
    if (!token) return json({ error: "Set TINA_UPDATE_GITHUB_TOKEN in Cloudflare Pages to enable updates." }, 503);

    const url = new URL(request.url);
    try {
        if (request.method === "GET") {
            const runId = url.searchParams.get("run");
            if (runId !== null && !/^\d+$/.test(runId)) return json({ error: "Invalid run ID." }, 400);
            return json(await getStatus(token, runId));
        }
        if (request.method === "POST") {
            if (request.headers.get("origin") !== url.origin) return json({ error: "Invalid request origin." }, 403);
            const latest = await getStatus(token);
            if (latest.status === "running" || latest.status === "ready") return json(latest);
            const run = await github(token, `/actions/workflows/${workflow}/dispatches`, { ref: "main" });
            if (!Number.isSafeInteger(run.workflow_run_id)) throw new Error("GitHub did not return a workflow run ID.");
            return json({
                status: "running",
                runId: run.workflow_run_id,
                runUrl: `https://github.com/${repository}/actions/runs/${run.workflow_run_id}`,
            }, 202);
        }
        return json({ error: "Method not allowed." }, 405);
    } catch (error) {
        return json({ error: `Unable to contact GitHub Actions. ${error instanceof Error ? error.message : ""}` }, 502);
    }
};

export const onRequest = [authenticate, handleRequest];
