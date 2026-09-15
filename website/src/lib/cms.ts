import siteData from "../cms/site.json";
import pagesData from "../cms/pages.json";

export type SiteConfig = typeof siteData;
export type PageRecord = (typeof pagesData)[string];

export const site = siteData as SiteConfig;
export const pages = pagesData as Record<string, PageRecord>;

export function getPageByPath(pagePath: string) {
  return pages[pagePath] || pages[pagePath.replace(/\/$/, "")] || null;
}

export function getAllPaths() {
  return Object.keys(pages).filter((p) => p !== "/");
}
