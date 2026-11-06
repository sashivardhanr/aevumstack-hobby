import { loadEnv } from 'vite';

export const env = { ...loadEnv(process.env.NODE_ENV || 'production', process.cwd(), ''), ...process.env };
const site = new URL(env.PUBLIC_SITE_URL || 'https://aevumstack.dev');
if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw new Error('PUBLIC_SITE_URL must be an HTTPS origin');
export const siteURL = site.origin;
