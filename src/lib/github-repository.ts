export const isGitHubRepository = (value: string) =>
    /^[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d._-]{1,100}$/i.test(value) &&
    !/\/\.{1,2}$/.test(value);
