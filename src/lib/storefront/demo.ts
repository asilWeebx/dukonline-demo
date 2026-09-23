import "server-only";

/**
 * Whether a placeholder catalog may stand in for the real one.
 *
 * This only stands in when the API is unreachable or the key is rejected —
 * otherwise the only reviewable state is the "store is not connected" notice,
 * which makes the whole UI impossible to demo. Two independent locks, because
 * a forgotten environment variable must not be able to put invented stock and
 * prices in front of a customer:
 *
 *   1. `STOREFRONT_DEMO` must be exactly "1". It is absent everywhere by
 *      default and lives only in .env.local, which is gitignored, so it cannot
 *      be committed by accident.
 *   2. `VERCEL_ENV` must not be "production". Vercel sets that itself and it
 *      cannot be overridden from project settings, so the deployment customers
 *      reach refuses placeholder data even if the flag is set on it.
 *
 * `VERCEL_ENV` rather than `NODE_ENV` is the right axis: a local
 * `next build && next start` still serves the placeholder, which is the point —
 * the skeleton has to be reviewable as a production build.
 */
export function demoEnabled(): boolean {
  return process.env.STOREFRONT_DEMO === "1" && process.env.VERCEL_ENV !== "production";
}
