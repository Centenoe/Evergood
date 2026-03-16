import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

/**
 * Authenticate the current request and return the user's Clerk ID.
 * Throws if no valid identity is found.
 *
 * Works in queries, mutations, and actions.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return identity.subject;
}
