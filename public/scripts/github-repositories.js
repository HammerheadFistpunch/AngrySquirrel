const requests = new Map();
const dateFormat = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
});

async function fetchMetadata(repository) {
    const response = await fetch(`https://api.github.com/repos/${repository}`, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];

    const data = await response.json();
    if (data?.private !== false) return [];

    const metadata = [];
    if (typeof data.language === "string" && data.language) metadata.push(data.language);
    if (Number.isSafeInteger(data.stargazers_count) && data.stargazers_count >= 0) {
        metadata.push(`${data.stargazers_count.toLocaleString("en-US")} ${data.stargazers_count === 1 ? "star" : "stars"}`);
    }
    const lastPush = Date.parse(data.pushed_at);
    if (Number.isFinite(lastPush)) metadata.push(`Last push ${dateFormat.format(lastPush)}`);
    if (data.archived === true) metadata.push("Archived");
    return metadata;
}

async function populateMetadata(card) {
    const repository = card.dataset.githubRepository.toLowerCase();
    if (!requests.has(repository)) {
        requests.set(repository, fetchMetadata(repository).catch(() => []));
    }
    const metadata = await requests.get(repository);
    if (!metadata.length) return;

    const list = card.querySelector("[data-repository-metadata]");
    for (const value of metadata) {
        const item = document.createElement("li");
        item.textContent = value;
        list.append(item);
    }
    list.hidden = false;
}

document.querySelectorAll("[data-github-repository]").forEach(populateMetadata);
