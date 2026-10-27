// Preview deployments must never call the production deploy hook or its KV lock.
export const getPublishPolicyError = (requestUrl, env) => {
    const url = new URL(requestUrl);
    if (url.protocol !== "https:" || !["angrysquirrel.org", "www.angrysquirrel.org"].includes(url.hostname)) {
        return "Production publishing is unavailable on previews. Test here, then merge into main and publish from angrysquirrel.org/admin/.";
    }
    if ((env.PUBLISH_GITHUB_BRANCH || "main") !== "main") {
        return "Production publishing must target main. Update PUBLISH_GITHUB_BRANCH and the Cloudflare deploy hook together.";
    }
    return null;
};
