export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 }
} as const;

export const MAX_PAGES = Number(process.env.WWS_MAX_PAGES || 50);
export const NAV_TIMEOUT = Number(process.env.WWS_NAV_TIMEOUT || 45000);
export const SETTLE_MS = Number(process.env.WWS_SETTLE_MS || 1200);
