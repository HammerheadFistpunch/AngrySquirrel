import React, { useEffect } from "react";
import type { TinaCMS } from "tinacms";
import { CommentsScreen } from "./CommentsScreen";
import { PublishSiteScreen } from "./PublishSite";
import { ImportEntryScreen } from "./ImportEntryScreen";

type NavigationCategory = "Settings" | "Pages" | "Content" | "Media" | "Site";

interface NavigationItem {
    name: string;
    category: NavigationCategory;
    target: string;
}

const navigationItems: NavigationItem[] = [
    { name: "Site Settings", category: "Settings", target: "#/collections/edit/settings/~/site" },
    { name: "Appearance", category: "Settings", target: "#/collections/edit/appearance/~/appearance" },
    { name: "Topics", category: "Settings", target: "#/collections/tags/~" },
    { name: "Main Homepage", category: "Pages", target: "#/collections/edit/homepage/~/home" },
    { name: "Journal Homepage", category: "Pages", target: "#/collections/edit/archivePage/~/journal" },
    { name: "About", category: "Pages", target: "#/collections/edit/standardPage/~/about" },
    { name: "Contact", category: "Pages", target: "#/collections/edit/standardPage/~/contact" },
    { name: "Resume", category: "Pages", target: "#/collections/edit/resumePage/~/resume" },
    { name: "Custom Pages", category: "Pages", target: "#/collections/flexiblePages/~" },
    { name: "Journal", category: "Content", target: "#/collections/entries/~" },
    { name: "Journal Sections", category: "Content", target: "#/collections/journalSections/~" },
    { name: "Media Manager", category: "Media", target: "#/media" },
];

const NavigationIcon = ({ className = "" }: { className?: string }) =>
    React.createElement(
        "span",
        {
            className,
            "aria-hidden": true,
            style: {
                alignItems: "center",
                display: "inline-flex",
                fontSize: "1.25rem",
                justifyContent: "center",
            },
        },
        "›",
    );

const createRedirectScreen = (target: string) => {
    const RedirectScreen = () => {
        useEffect(() => {
            window.location.hash = target;
        }, []);

        return React.createElement(
            "p",
            { style: { padding: "2rem" } },
            "Opening editor…",
        );
    };

    return RedirectScreen;
};

const normalizeHeading = (heading: Element) =>
    heading.textContent?.trim().toLowerCase();

const organizeSidebar = () => {
    const headings = Array.from(document.querySelectorAll("h4"));
    const collectionsHeading = headings.find(
        (heading) => normalizeHeading(heading) === "collections",
    );

    if (!collectionsHeading) return;

    const navigation = collectionsHeading.parentElement;
    if (!navigation) return;

    collectionsHeading.setAttribute("hidden", "");
    collectionsHeading.nextElementSibling?.setAttribute("hidden", "");

    const siteHeading = headings.find(
        (heading) =>
            normalizeHeading(heading) === "site" &&
            heading.parentElement === navigation,
    );

    const groups = ["Settings", "Pages", "Content", "Media"].map((category) => {
        const categoryHeading = headings.find(
            (heading) => normalizeHeading(heading) === category.toLowerCase(),
        );
        const categoryGroup = categoryHeading?.parentElement;
        return categoryGroup?.parentElement === navigation ? categoryGroup : undefined;
    });

    if (groups.some((group) => !group)) return;

    const [settingsGroup, pagesGroup, contentGroup, mediaGroup] = groups as HTMLElement[];
    const anchor = siteHeading?.parentElement === navigation ? siteHeading : null;

    if (anchor) {
        navigation.insertBefore(settingsGroup, anchor);
        navigation.insertBefore(pagesGroup, anchor);
        navigation.insertBefore(contentGroup, anchor);
        navigation.insertBefore(mediaGroup, anchor);
    }
};

const clarifyTopicStatus = () => {
    if (!window.location.hash.includes("/collections/edit/tags/")) return;

    const labels = Array.from(document.querySelectorAll("label, p, span, div"))
        .filter((element) => element.textContent?.trim() === "Active");

    for (const label of labels) {
        let fieldContainer: Element | null = label.parentElement;

        for (let depth = 0; fieldContainer && depth < 5; depth += 1) {
            if (fieldContainer.querySelector('input[type="checkbox"], [role="switch"]')) break;
            fieldContainer = fieldContainer.parentElement;
        }

        if (!fieldContainer || fieldContainer.querySelector("[data-topic-status-legend]")) continue;

        const legend = document.createElement("p");
        legend.dataset.topicStatusLegend = "true";
        legend.textContent = "Off = Retired · On = Active";
        Object.assign(legend.style, {
            color: "#64748b",
            fontSize: "12px",
            lineHeight: "1.4",
            margin: "6px 0 0",
        });
        fieldContainer.appendChild(legend);
    }
};

const organizeAdmin = () => {
    organizeSidebar();
    clarifyTopicStatus();
};

const installSidebarOrganizer = () => {
    if (typeof window === "undefined") return;

    const navigationWindow = window as typeof window & {
        __angrySquirrelNavigationInstalled?: boolean;
    };

    if (navigationWindow.__angrySquirrelNavigationInstalled) return;
    navigationWindow.__angrySquirrelNavigationInstalled = true;

    const observer = new MutationObserver(organizeAdmin);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", organizeAdmin);
    organizeAdmin();
};

export const installAdminNavigation = (cms: TinaCMS) => {
    const screens = cms.plugins.getType("screen").all();

    for (const item of navigationItems) {
        if (screens.some((screen) => screen.name === item.name)) continue;

        cms.plugins.add({
            __type: "screen",
            name: item.name,
            Component: createRedirectScreen(item.target),
            Icon: NavigationIcon,
            layout: "fullscreen",
            navCategory: item.category,
        } as never);
    }

    if (!screens.some((screen) => screen.name === "Import")) {
        cms.plugins.add({
            __type: "screen",
            name: "Import",
            Component: ImportEntryScreen,
            Icon: NavigationIcon,
            layout: "fullscreen",
            navCategory: "Content",
        } as never);
    }

    if (!screens.some((screen) => screen.name === "Comments")) {
        cms.plugins.add({
            __type: "screen", name: "Comments", Component: CommentsScreen,
            Icon: NavigationIcon, layout: "fullscreen", navCategory: "Content",
        } as never);
    }

    if (!screens.some((screen) => screen.name === "Publish Site")) {
        cms.plugins.add({
            __type: "screen",
            name: "Publish Site",
            Component: PublishSiteScreen,
            Icon: NavigationIcon,
            layout: "fullscreen",
            navCategory: "Settings",
        } as never);
    }

    installSidebarOrganizer();
    return cms;
};
