import { defineConfig } from "tinacms";
import MarkdownBodyField from "./components/MarkdownBodyField";
import ExternalImageField from "./components/ExternalImageField";
import SectionOrderField from "./components/SectionOrderField";
import JournalSectionField from "./components/JournalSectionField";
import PublicationStatusField from "./components/PublicationStatusField";
import TopicField from "./components/TopicField";
import { installAdminNavigation } from "./components/AdminNavigation";
import { getImageSourceError } from "../src/lib/image-sources";

// The actual Pages build branch takes priority over stale environment overrides.
const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_BRANCH || process.env.HEAD || "main";

const linkFields = [
    { type: "string" as const, name: "label", label: "Label", required: true },
    { type: "string" as const, name: "href", label: "Link", required: true },
];

const externalImageUi = {
    component: ExternalImageField,
    clearable: true,
    validate: (value?: string) => getImageSourceError(value),
};

const homepagePortfolioLinkFields = [
    ...linkFields,
    {
        type: "image" as const,
        name: "image",
        label: "Optional Image",
        description: "Shown behind the destination label. Leave blank for a simple text tile.",
        ui: externalImageUi,
    },
];

const navigationDestinationFields = [
    { type: "string" as const, name: "label", label: "Label", required: true },
    {
        type: "reference" as const,
        name: "page",
        label: "Internal Page",
        collections: ["homepage", "archivePage", "standardPage", "resumePage", "flexiblePages"],
        description: "Choose a Tina-managed page. Leave blank when using a custom or external URL.",
    },
    {
        type: "string" as const,
        name: "href",
        label: "Custom or External URL",
        description: "Use for fixed site routes or full external URLs. An internal-page selection takes priority when both are present.",
    },
];

const navigationItemFields = [
    ...navigationDestinationFields,
    {
        type: "object" as const,
        name: "children",
        label: "Child Links",
        list: true,
        description: "Optional links shown in this item's submenu.",
        ui: { itemProps: (item: Record<string, unknown>) => ({ label: (item?.label as string) || "Child link" }) },
        fields: navigationDestinationFields,
    },
];

const flexiblePageBlockTemplates = [
    {
        name: "richText",
        label: "Rich Text",
        ui: {
            itemProps: (item: Record<string, unknown>) => ({ label: (item?.heading as string) || "Rich Text" }),
            defaultItem: { markdown: "" },
        },
        fields: [
            { type: "string" as const, name: "heading", label: "Optional Heading" },
            {
                type: "string" as const,
                name: "markdown",
                label: "Text (Markdown)",
                description: "Portable Markdown text. Use blank lines between paragraphs.",
                required: true,
                ui: { component: "textarea" },
            },
        ],
    },
    {
        name: "image",
        label: "Image",
        ui: { itemProps: (item: Record<string, unknown>) => ({ label: (item?.heading as string) || (item?.caption as string) || "Image" }) },
        fields: [
            { type: "string" as const, name: "heading", label: "Optional Heading" },
            { type: "image" as const, name: "src", label: "Image", required: true, ui: externalImageUi },
            { type: "string" as const, name: "alt", label: "Alt Text", description: "Describe meaningful images. Leave blank only when the image is decorative." },
            { type: "string" as const, name: "caption", label: "Caption", ui: { component: "textarea" } },
        ],
    },
    {
        name: "youtube",
        label: "YouTube Video",
        ui: { itemProps: (item: Record<string, unknown>) => ({ label: (item?.title as string) || "YouTube Video" }) },
        fields: [
            { type: "string" as const, name: "heading", label: "Optional Heading" },
            { type: "string" as const, name: "url", label: "YouTube URL", required: true, description: "Paste a standard youtube.com, youtu.be, or YouTube embed URL." },
            { type: "string" as const, name: "title", label: "Accessible Video Title", required: true },
            { type: "string" as const, name: "caption", label: "Caption", ui: { component: "textarea" } },
        ],
    },
    {
        name: "immichGallery",
        label: "Immich Gallery",
        ui: { itemProps: (item: Record<string, unknown>) => ({ label: (item?.heading as string) || "Immich Gallery" }) },
        fields: [
            { type: "string" as const, name: "heading", label: "Gallery Heading" },
            { type: "string" as const, name: "shareUrl", label: "Public Immich Share URL", required: true },
            { type: "string" as const, name: "imageAltPrefix", label: "Image Alt Prefix", description: "Short description used before each image number, such as Event photo." },
        ],
    },
    {
        name: "childPages",
        label: "Child Page Tiles",
        ui: {
            itemProps: (item: Record<string, unknown>) => ({ label: (item?.heading as string) || "Child Page Tiles" }),
            defaultItem: { paths: [] },
        },
        fields: [
            { type: "string" as const, name: "heading", label: "Section Heading" },
            { type: "string" as const, name: "introduction", label: "Introduction", ui: { component: "textarea" } },
            { type: "string" as const, name: "paths", label: "Page Paths", list: true, description: "Add complete Custom Page paths without leading slashes, in the order the tiles should appear." },
        ],
    },
    {
        name: "bentoGrid",
        label: "Bento Grid",
        ui: {
            itemProps: (item: Record<string, unknown>) => ({ label: (item?.heading as string) || "Bento Grid" }),
            defaultItem: { tiles: [] },
        },
        fields: [
            { type: "string" as const, name: "heading", label: "Section Heading" },
            { type: "string" as const, name: "introduction", label: "Introduction", ui: { component: "textarea" } },
            {
                type: "object" as const,
                name: "tiles",
                label: "Bento Tiles",
                list: true,
                description: "Add and drag tiles into the order you want them to appear.",
                ui: {
                    itemProps: (item: Record<string, unknown>) => ({ label: (item?.title as string) || "Bento tile" }),
                    defaultItem: { size: "small" },
                },
                fields: [
                    { type: "string" as const, name: "title", label: "Title", required: true },
                    { type: "string" as const, name: "eyebrow", label: "Category / Eyebrow" },
                    { type: "string" as const, name: "description", label: "Description", ui: { component: "textarea" } },
                    { type: "image" as const, name: "image", label: "Image", ui: externalImageUi },
                    { type: "string" as const, name: "imageAlt", label: "Image Alt Text" },
                    { type: "string" as const, name: "internalPath", label: "Internal Custom Page Path", description: "Use a Custom Page path without a leading slash, such as tools/tire-thermal. If this resolves to a published Custom Page, it takes priority over the URL below." },
                    { type: "string" as const, name: "href", label: "Custom or External URL", description: "Use a site path or full external URL when the tile does not target another Custom Page." },
                    { type: "string" as const, name: "linkLabel", label: "Link Label", description: "Optional. Defaults to View." },
                    { type: "string" as const, name: "size", label: "Tile Size", required: true, options: [
                        { value: "small", label: "Small" },
                        { value: "wide", label: "Wide" },
                        { value: "large", label: "Large" },
                    ] },
                ],
            },
        ],
    },
    {
        name: "callToAction",
        label: "Call to Action",
        ui: { itemProps: (item: Record<string, unknown>) => ({ label: (item?.heading as string) || (item?.label as string) || "Call to Action" }), defaultItem: { style: "primary" } },
        fields: [
            { type: "string" as const, name: "heading", label: "Heading" },
            { type: "string" as const, name: "text", label: "Supporting Text", ui: { component: "textarea" } },
            { type: "string" as const, name: "label", label: "Button Label", required: true },
            { type: "string" as const, name: "href", label: "Button Link", required: true },
            { type: "string" as const, name: "style", label: "Button Style", required: true, options: [{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }] },
        ],
    },
];

const appearanceFields = [
    { type: "string" as const, name: "uiFont", label: "UI Font", required: true, options: [
        { value: "Lato", label: "Lato" },
        { value: "Inter", label: "Inter" },
        { value: "Source Sans 3", label: "Source Sans 3" },
        { value: "System Sans", label: "System Sans" },
    ], description: "Used for navigation, buttons, labels, and general interface text." },
    { type: "string" as const, name: "editorialFont", label: "Editorial Font", required: true, options: [
        { value: "Newsreader", label: "Newsreader" },
        { value: "Merriweather", label: "Merriweather" },
        { value: "Source Serif 4", label: "Source Serif 4" },
        { value: "Georgia", label: "Georgia" },
    ], description: "Used for headings and editorial typography." },
    { type: "number" as const, name: "bodyFontSize", label: "Body Font Size (px)", required: true, description: "Base site text size. Recommended range: 16–22." },
    { type: "number" as const, name: "articleFontSize", label: "Article Font Size (px)", required: true, description: "Journal and long-form paragraph size. Recommended range: 18–26." },
    { type: "number" as const, name: "headingScale", label: "Heading Scale", required: true, description: "Multiplier for headings. 1.0 is the current design; try 0.9–1.15." },
    { type: "number" as const, name: "lineHeight", label: "Line Height", required: true, description: "Base line-height multiplier. Recommended range: 1.4–1.9." },
    { type: "number" as const, name: "contentWidth", label: "Maximum Site Width (px)", required: true, description: "Maximum width for primary site containers." },
    { type: "number" as const, name: "readingWidth", label: "Reading Column Width (px)", required: true, description: "Maximum width of long-form article text." },
    { type: "string" as const, name: "backgroundColor", label: "Page Background", required: true, description: "CSS color, preferably a hex value." },
    { type: "string" as const, name: "surfaceColor", label: "Surface Background", required: true, description: "Cards, menus, and secondary surfaces." },
    { type: "string" as const, name: "elevatedColor", label: "Elevated Surface", required: true, description: "Higher-contrast elevated surfaces." },
    { type: "string" as const, name: "textColor", label: "Primary Text", required: true },
    { type: "string" as const, name: "secondaryTextColor", label: "Secondary Text", required: true },
    { type: "string" as const, name: "accentColor", label: "Accent Color", required: true },
    { type: "number" as const, name: "smallRadius", label: "Small Corner Radius (px)", required: true },
    { type: "number" as const, name: "mediumRadius", label: "Medium Corner Radius (px)", required: true },
    { type: "number" as const, name: "smallSpacing", label: "Small Spacing (px)", required: true },
    { type: "number" as const, name: "mediumSpacing", label: "Medium Spacing (px)", required: true },
    { type: "number" as const, name: "largeSpacing", label: "Large Spacing (px)", required: true },
    { type: "number" as const, name: "extraLargeSpacing", label: "Extra Large Spacing (px)", required: true },
];

export default defineConfig({
    branch,
    cmsCallback: installAdminNavigation,
    clientId: process.env.TINA_PUBLIC_CLIENT_ID || "",
    token: process.env.TINA_TOKEN || "",
    build: { outputFolder: "admin", publicFolder: "public" },
    media: { tina: { mediaRoot: "uploads", publicFolder: "public" } },
    schema: {
        collections: [
            {
                name: "appearance",
                label: "Appearance",
                path: "src/data",
                format: "json",
                match: { include: "appearance" },
                ui: { allowedActions: { create: false, delete: false } },
                fields: appearanceFields,
            },
            {
                name: "tags",
                label: "Topics",
                path: "src/content/tags",
                format: "md",
                defaultItem: () => ({ active: true }),
                ui: {
                    allowedActions: { create: true, delete: false },
                    filename: {
                        slugify: (values) => values?.label?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-topic",
                    },
                },
                fields: [
                    { type: "string", name: "label", label: "Topic Name", required: true, isTitle: true, description: "Visible name. Rename this freely without changing the public URL." },
                    { type: "string", name: "description", label: "Description", ui: { component: "textarea" }, description: "Optional description used on the Topic archive page." },
                    { type: "boolean", name: "active", label: "Active", description: "Retire a Topic instead of deleting it. Retired Topics disappear from new-entry selectors but remain valid on existing stories." },
                    { type: "reference", name: "replacement", label: "Replacement Topic", collections: ["tags"], description: "Optional. For a retired duplicate, choose the Topic that should replace it. Old URLs and story references resolve to the replacement." },
                    { type: "string", name: "slug", label: "Permanent URL Slug", required: true, description: "Stable lowercase URL value. Treat this as permanent after publication." },
                    { type: "string", name: "aliases", label: "Previous URL Slugs", list: true, description: "Optional old slugs that must continue resolving after an intentional URL migration." },
                ],
            },
            {
                name: "journalSections",
                label: "Journal Sections",
                path: "src/content/journal-sections",
                format: "md",
                ui: {
                    allowedActions: { create: true, delete: true },
                    filename: { slugify: (values) => values?.label?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-section" },
                },
                fields: [
                    { type: "string", name: "label", label: "Section Name", required: true, isTitle: true, description: "Public name. Change this freely; entries keep their stable section slug." },
                    { type: "string", name: "slug", label: "Permanent Slug", required: true, description: "Stable value stored on Journal entries and used in the section URL." },
                    { type: "string", name: "description", label: "Section Description", ui: { component: "textarea" } },
                    { type: "boolean", name: "active", label: "Active", description: "Inactive sections disappear from Journal navigation; their stories fall back to Latest." },
                    { type: "string", name: "aliases", label: "Previous Slugs", list: true, description: "Optional previous URLs that should continue resolving after a slug migration." },
                ],
            },
            {
                name: "settings",
                label: "Site Settings",
                path: "src/content/settings",
                format: "md",
                ui: { allowedActions: { create: false, delete: false } },
                fields: [
                    { type: "string", name: "siteName", label: "Site Name", required: true },
                    { type: "string", name: "logoText", label: "Logo Text", required: true },
                    { type: "string", name: "siteDescription", label: "Site Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "footerTitle", label: "Footer Title", required: true },
                    { type: "string", name: "footerDescription", label: "Footer Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "copyrightName", label: "Copyright Name", required: true },
                    { type: "object", name: "navigation", label: "Main Navigation", list: true, description: "Drag to reorder. Add child links only when a top-level destination needs a submenu.", ui: { itemProps: (item) => ({ label: item?.label || "Navigation item" }) }, fields: navigationItemFields },
                    { type: "object", name: "footerLinks", label: "Footer Links", list: true, fields: linkFields },
                ],
            },
            {
                name: "homepage",
                label: "Main Homepage",
                path: "src/content/pages",
                format: "md",
                match: { include: "home" },
                ui: { allowedActions: { create: false, delete: false } },
                fields: [
                    { type: "string", name: "pageType", label: "Page Type", required: true, options: [{ value: "home", label: "Homepage" }], ui: { component: "hidden" } },
                    { type: "string", name: "description", label: "SEO Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "sectionOrder", label: "Homepage Section Order", list: true, required: true, description: "Drag the rows into place. The arrow buttons provide the same control from a keyboard.", ui: { component: SectionOrderField } },
                    {
                        type: "object", name: "hero", label: "Homepage Hero", required: true,
                        fields: [
                            { type: "boolean", name: "visible", label: "Show Hero" },
                            { type: "string", name: "eyebrow", label: "Eyebrow" },
                            { type: "string", name: "title", label: "Headline", required: true },
                            { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                            { type: "image", name: "image", label: "Hero Image", ui: externalImageUi },
                            { type: "object", name: "primaryCta", label: "Primary Button", required: true, fields: linkFields },
                            { type: "object", name: "secondaryCta", label: "Secondary Button", required: true, fields: linkFields },
                        ],
                    },
                    {
                        type: "object", name: "portfolioLinks", label: "Portfolio Links Section", required: true,
                        fields: [
                            { type: "boolean", name: "visible", label: "Show Portfolio Links" },
                            { type: "string", name: "title", label: "Section Title", required: true },
                            { type: "string", name: "subtitle", label: "Section Description", required: true, ui: { component: "textarea" } },
                            { type: "object", name: "links", label: "Portfolio Destinations", list: true, required: true, description: "Add and drag the compact destination links shown on the Homepage.", ui: { itemProps: (item) => ({ label: item?.label || "Portfolio destination" }) }, fields: homepagePortfolioLinkFields },
                        ],
                    },
                    {
                        type: "object", name: "journalPreview", label: "Journal Preview Section", description: "Featured story is managed under Journal Homepage and shared with this preview.", required: true,
                        fields: [
                            { type: "boolean", name: "visible", label: "Show Journal Preview" },
                            { type: "string", name: "title", label: "Section Title", required: true },
                            { type: "string", name: "titleHref", label: "Title Link", required: true, description: "Site path linked from the section title, such as /journal/." },
                            { type: "string", name: "subtitle", label: "Section Description", required: true, ui: { component: "textarea" } },
                            { type: "number", name: "recentLimit", label: "Recent Story Count", required: true },
                            { type: "string", name: "emptyMessage", label: "Empty-State Message", required: true },
                        ],
                    },
                    {
                        type: "object", name: "aboutSection", label: "About Me Section", required: true,
                        fields: [
                            { type: "boolean", name: "visible", label: "Show About Me" },
                            { type: "string", name: "eyebrow", label: "Eyebrow" },
                            { type: "string", name: "title", label: "Title", required: true },
                            { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                            { type: "object", name: "link", label: "Link", required: true, fields: linkFields },
                        ],
                    },
                    {
                        type: "object", name: "capabilitiesSection", label: "What I Do Section", required: true,
                        fields: [
                            { type: "boolean", name: "visible", label: "Show What I Do" },
                            { type: "string", name: "eyebrow", label: "Eyebrow" },
                            { type: "string", name: "title", label: "Title", required: true },
                            { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                            { type: "object", name: "items", label: "Capabilities", list: true, required: true, ui: { itemProps: (item) => ({ label: item?.title || "Capability" }) }, fields: [
                                { type: "string", name: "title", label: "Title", required: true },
                                { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                                { type: "string", name: "href", label: "Optional Link" },
                            ] },
                            { type: "object", name: "link", label: "Section Link", required: true, fields: linkFields },
                        ],
                    },
                    {
                        type: "object", name: "technologySection", label: "Technology Stack Section", required: true,
                        fields: [
                            { type: "boolean", name: "visible", label: "Show Technology Stack" },
                            { type: "string", name: "eyebrow", label: "Eyebrow" },
                            { type: "string", name: "title", label: "Title", required: true },
                            { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                            { type: "string", name: "items", label: "Tools and Platforms", list: true, required: true, ui: { component: "tags" } },
                            { type: "object", name: "link", label: "Section Link", required: true, fields: linkFields },
                        ],
                    },
                ],
            },
            {
                name: "archivePage", label: "Journal Homepage", path: "src/content/pages", format: "md", match: { include: "journal" }, ui: { allowedActions: { create: false, delete: false } },
                fields: [
                    { type: "string", name: "pageType", label: "Page Type", required: true, options: [{ value: "archive", label: "Archive Page" }], ui: { component: "hidden" } },
                    { type: "string", name: "title", label: "Page Title", required: true, isTitle: true },
                    { type: "string", name: "eyebrow", label: "Eyebrow" },
                    { type: "string", name: "headline", label: "Headline", required: true },
                    { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "sectionTitle", label: "Content Section Title", required: true },
                    { type: "string", name: "emptyMessage", label: "Empty-State Message", required: true },
                    { type: "reference", name: "featuredEntry", label: "Featured Journal Story", description: "Shown on both the main homepage preview and Journal homepage. Leave blank to feature the newest published story. Draft or missing selections also fall back to the newest published story.", collections: ["entries"] },
                ],
            },
            {
                name: "standardPage", label: "Standard Pages", path: "src/content/pages", format: "md", match: { include: "{about,contact}" }, ui: { allowedActions: { create: false, delete: false } },
                fields: [
                    { type: "string", name: "pageType", label: "Page Type", required: true, options: [{ value: "standard", label: "Standard Page" }], ui: { component: "hidden" } },
                    { type: "string", name: "title", label: "Page Title", required: true, isTitle: true },
                    { type: "string", name: "eyebrow", label: "Eyebrow" },
                    { type: "string", name: "headline", label: "Headline", required: true },
                    { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "headerStyle", label: "Header Style", required: true, options: [{ value: "compact", label: "Compact" }, { value: "featured", label: "Featured" }] },
                    { type: "object", name: "links", label: "Page Links", list: true, fields: linkFields },
                    { type: "string", name: "body", label: "Page Content (Markdown)", description: "Write portable Markdown with the same editor used for Journal entries.", isBody: true, ui: { component: MarkdownBodyField } },
                ],
            },
            {
                name: "resumePage", label: "Resume", path: "src/content/pages", format: "md", match: { include: "resume" }, ui: { allowedActions: { create: false, delete: false } },
                fields: [
                    { type: "string", name: "pageType", label: "Page Type", required: true, options: [{ value: "standard", label: "Standard Page" }], ui: { component: "hidden" } },
                    { type: "string", name: "title", label: "Page Title", required: true, isTitle: true },
                    { type: "string", name: "eyebrow", label: "Eyebrow" },
                    { type: "string", name: "headline", label: "Headline", required: true },
                    { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "headerStyle", label: "Header Style", required: true, options: [{ value: "compact", label: "Compact" }, { value: "featured", label: "Featured" }] },
                    { type: "object", name: "links", label: "Page Links", list: true, fields: linkFields },
                    { type: "string", name: "professionalSummary", label: "Professional Summary", ui: { component: "textarea" } },
                    { type: "object", name: "competencies", label: "Core Competencies", list: true, ui: { itemProps: (item) => ({ label: item?.title || "Competency" }) }, fields: [
                        { type: "string", name: "title", label: "Competency", required: true },
                        { type: "string", name: "description", label: "Supporting Detail", required: true, ui: { component: "textarea" } },
                    ] },
                    { type: "object", name: "experience", label: "Experience", list: true, ui: { itemProps: (item) => ({ label: item?.title || "Experience entry" }) }, fields: [
                        { type: "string", name: "period", label: "Period", required: true },
                        { type: "string", name: "title", label: "Role or Title", required: true },
                        { type: "string", name: "organization", label: "Organization" },
                        { type: "string", name: "location", label: "Location" },
                        { type: "string", name: "description", label: "Description", ui: { component: "textarea" } },
                        { type: "string", name: "highlights", label: "Highlights", list: true },
                    ] },
                    { type: "object", name: "education", label: "Education", list: true, ui: { itemProps: (item) => ({ label: item?.degree || "Education entry" }) }, fields: [
                        { type: "string", name: "degree", label: "Degree or Credential", required: true },
                        { type: "string", name: "institution", label: "Institution", required: true },
                        { type: "string", name: "focus", label: "Focus or Emphasis" },
                        { type: "string", name: "period", label: "Period" },
                    ] },
                ],
            },
            {
                name: "flexiblePages", label: "Custom Pages", path: "src/content/flexible-pages", format: "md", defaultItem: () => ({ draft: true }),
                ui: { allowedActions: { create: true, delete: true }, filename: { slugify: (values) => values?.title?.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-page" } },
                fields: [
                    { type: "string", name: "title", label: "Page Title", required: true, isTitle: true },
                    { type: "string", name: "path", label: "URL Path", required: true, description: "Lowercase path without a leading slash, such as portfolio/video." },
                    { type: "string", name: "description", label: "Page Description", required: true, ui: { component: "textarea" } },
                    { type: "string", name: "eyebrow", label: "Eyebrow" },
                    { type: "image", name: "headerImage", label: "Header Image", ui: externalImageUi },
                    { type: "string", name: "headerImageAlt", label: "Header Image Alt Text" },
                    { type: "string", name: "navigationLabel", label: "Navigation Label" },
                    { type: "boolean", name: "draft", label: "Draft", description: "Draft pages are saved in Git but do not receive a public route." },
                    { type: "string", name: "seoTitle", label: "SEO Title" },
                    { type: "string", name: "seoDescription", label: "SEO Description", ui: { component: "textarea" } },
                    { type: "image", name: "seoImage", label: "Social Sharing Image", ui: externalImageUi },
                    { type: "object", name: "blocks", label: "Page Blocks", list: true, templates: flexiblePageBlockTemplates, description: "Add, remove, and drag blocks to control the page order.", openFormOnCreate: true },
                    { type: "string", name: "body", label: "Legacy Page Content (Markdown)", description: "Existing Markdown remains supported and renders after Page Blocks. New modular page sections should use Page Blocks.", isBody: true, ui: { component: MarkdownBodyField } },
                ],
            },
            {
                name: "entries", label: "Journal", path: "src/content/entries", format: "mdx", defaultItem: () => ({
                    draft: true,
                    date: new Date().toISOString(),
                    body: "",
                }),
                fields: [
                    { type: "string", name: "title", label: "Title", required: true, isTitle: true },
                    { type: "string", name: "body", label: "Entry Content (Markdown)", description: "Write portable Markdown. Use the toolbar for formatting, links, Immich/R2, managed/external images, and YouTube embeds.", required: true, isBody: true, ui: { component: MarkdownBodyField } },
                    { type: "string", name: "journalSection", label: "Journal Section", description: "Choose one active section, or leave blank for Latest only.", ui: { component: JournalSectionField } },
                    { type: "boolean", name: "commentsDisabled", label: "Disable Comments", description: "Hide the discussion and stop new comments on this entry after publishing. Leave off to allow moderated comments." },
                    { type: "boolean", name: "pinned", label: "Pin in Journal", description: "Keep this published post above unpinned posts on the Journal page and in its section. Pin as many posts as you like; pinned posts appear newest first. The featured story is selected separately." },
                    { type: "boolean", name: "draft", label: "Status", description: "Choose whether this story is public.", ui: { component: PublicationStatusField } },
                    {
                        type: "object",
                        name: "tags",
                        label: "Topics",
                        list: true,
                        description: "Choose what this story is about. Topics power related stories and topic archives. Add or retire Topics under Settings → Topics.",
                        ui: { component: TopicField },
                        fields: [{ type: "reference", name: "tag", label: "Topic", required: true, collections: ["tags"] }],
                    },
                    { type: "string", name: "description", label: "Description", required: true, ui: { component: "textarea" }, description: "Short summary used on Journal cards and in search/social metadata." },
                    { type: "datetime", name: "date", label: "Publication Date", description: "Defaults to today for new entries and controls Journal chronology." },
                    { type: "image", name: "coverImage", label: "Cover Image", ui: externalImageUi },
                    { type: "object", name: "immichGallery", label: "Immich Gallery", description: "Display a live gallery from a public share.angrysquirrel.org album link.", fields: [
                        { type: "string", name: "shareUrl", label: "Public Share URL", required: true },
                        { type: "string", name: "title", label: "Gallery Title" },
                        { type: "string", name: "imageAltPrefix", label: "Image Description Prefix" },
                    ] },
                ],
            },
        ],
    },
});

