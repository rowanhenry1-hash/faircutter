/**
 * PostHog scaffolding — opt-in analytics.
 *
 * Initialized only if `POSTHOG_KEY` is set in the environment. If unset
 * (the default during early development), every call is a no-op. Keeping
 * the surface minimal so nothing breaks if the env is missing.
 *
 * Privacy-first defaults: no autocapture, no session recording, no IP
 * collection. Manual `track()` calls only.
 *
 * Sentry is intentionally NOT scaffolded in code at this stage — the
 * official `@sentry/nextjs` wizard rewrites build configuration, which the
 * blueprint's "low-risk" qualifier rules out for the launch review pass.
 * Add Sentry as a deliberate follow-up; see README for the upgrade path.
 */
import "server-only";
import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  if (_client) return _client;
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  _client = new PostHog(key, {
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
}

export async function track(args: {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}) {
  const client = getClient();
  if (!client) return;
  try {
    client.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
    });
    await client.flush();
  } catch {
    // Never throw from analytics.
  }
}
