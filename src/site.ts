/** Public URL of the site (set NEXT_PUBLIC_SITE_URL on the host, e.g. in Vercel's project settings). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cellula.vercel.app').replace(/\/$/, '');
