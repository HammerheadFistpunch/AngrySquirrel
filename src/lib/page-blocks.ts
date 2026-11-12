import { z } from "astro/zod";
import { getImageSourceError } from "./image-sources";
import { isGitHubRepository } from "./github-repository";

const optionalText = z.string().optional();
const optionalImageSource = z.string().superRefine((value, context) => {
    const error = getImageSourceError(value);
    if (error) context.addIssue({ code: "custom", message: error });
}).optional();

export const flexiblePageBlockSchema = z.discriminatedUnion("_template", [
    z.object({
        _template: z.literal("richText"),
        heading: optionalText,
        markdown: z.string().default(""),
    }),
    z.object({
        _template: z.literal("image"),
        heading: optionalText,
        src: optionalImageSource,
        alt: optionalText,
        caption: optionalText,
    }),
    z.object({
        _template: z.literal("youtube"),
        heading: optionalText,
        url: optionalText,
        title: optionalText,
        caption: optionalText,
    }),
    z.object({
        _template: z.literal("immichGallery"),
        heading: optionalText,
        shareUrl: optionalText,
        imageAltPrefix: optionalText,
    }),
    z.object({
        _template: z.literal("githubRepositories"),
        heading: optionalText,
        repositories: z.array(z.object({
            repository: z.string().trim().refine(isGitHubRepository, "Use a GitHub owner/repository name."),
            title: optionalText,
            summary: z.string().trim().min(1),
        })).default([]),
    }),
    z.object({
        _template: z.literal("childPages"),
        heading: optionalText,
        introduction: optionalText,
        paths: z.array(z.string()).default([]),
    }),
    z.object({
        _template: z.literal("bentoGrid"),
        heading: optionalText,
        introduction: optionalText,
        tiles: z.array(z.object({
            title: optionalText,
            eyebrow: optionalText,
            description: optionalText,
            image: optionalImageSource,
            imageAlt: optionalText,
            internalPath: optionalText,
            href: optionalText,
            linkLabel: optionalText,
            size: z.enum(["small", "wide", "large"]).default("small"),
        })).default([]),
    }),
    z.object({
        _template: z.literal("callToAction"),
        heading: optionalText,
        text: optionalText,
        label: optionalText,
        href: optionalText,
        style: z.enum(["primary", "secondary"]).default("primary"),
    }),
]);

export type FlexiblePageBlock = z.infer<typeof flexiblePageBlockSchema>;
