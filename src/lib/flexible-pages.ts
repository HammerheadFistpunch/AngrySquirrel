export const RESERVED_TOP_LEVEL_PATHS = new Set([
    "_astro",
    "about",
    "admin",
    "archive",
    "contact",
    "journal",
    "portfolio",
    "resume",
    "privacy",
    "security",
    "uploads",
]);

const PATH_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeFlexiblePagePath(value: string): string {
    return value.trim().replace(/^\/+|\/+$/g, "");
}

export function validateFlexiblePagePath(value: string): string | undefined {
    const path = normalizeFlexiblePagePath(value);

    if (!path) {
        return "Enter at least one URL segment, such as services.";
    }

    if (value.includes("?") || value.includes("#")) {
        return "Do not include a query string or fragment in the page path.";
    }

    const segments = path.split("/");

    if (segments.some((segment) => !PATH_SEGMENT_PATTERN.test(segment))) {
        return "Use lowercase letters, numbers, and single hyphens in each path segment.";
    }

    const isPortfolioChild = segments[0] === "portfolio" && segments.length > 1;

    if (RESERVED_TOP_LEVEL_PATHS.has(segments[0]) && !isPortfolioChild) {
        return `The top-level path "${segments[0]}" is reserved by the site.`;
    }

    return undefined;
}
