import test from "node:test";
import assert from "node:assert/strict";
import { getPublishPolicyError } from "../src/server/publish-policy.js";
import { onRequest } from "../functions/admin/api/publish.js";

test("only the public HTTPS production hosts may publish main", () => {
    for (const host of ["angrysquirrel.org", "www.angrysquirrel.org"]) {
        assert.equal(getPublishPolicyError(`https://${host}/admin/api/publish`, {}), null);
        assert.equal(getPublishPolicyError(`https://${host}/admin/api/publish`, { PUBLISH_GITHUB_BRANCH: "main" }), null);
    }
});

test("preview, local and lookalike hosts cannot use a production hook", () => {
    for (const origin of ["https://development.example.pages.dev", "https://abc.example.pages.dev", "https://dev.angrysquirrel.org", "https://angrysquirrel.org.example.com", "http://angrysquirrel.org", "http://localhost:4321"]) {
        assert.ok(getPublishPolicyError(`${origin}/admin/api/publish`, { PUBLISH_GITHUB_BRANCH: "main", CLOUDFLARE_DEPLOY_HOOK_URL: "production-secret" }));
    }
});

test("stale and development branch overrides are rejected on production", () => {
    for (const branch of ["gpt-handoff", "development", "feature/example"]) {
        assert.ok(getPublishPolicyError("https://angrysquirrel.org/admin/api/publish", { PUBLISH_GITHUB_BRANCH: branch }));
    }
});

test("every preview method stops before authentication, state access or publishing", async () => {
    for (const method of ["GET", "POST", "DELETE"]) {
        const response = await onRequest[0]({
            request: new Request("https://development.example.pages.dev/admin/api/publish", { method }),
            env: new Proxy({}, { get() { throw new Error("Preview touched production configuration"); } }),
            next() { throw new Error("Preview continued into production middleware"); },
        });
        assert.equal(response.status, 403);
        assert.equal((await response.json()).configured, false);
    }
});
