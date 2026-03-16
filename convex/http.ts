import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

/**
 * Allowed CORS origins. In production, replace with your deployment URL.
 * process.env is available in Convex actions/httpActions at runtime.
 */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
]);

function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("Origin") ?? "";
  // Allow configured origins, plus any origin set via environment variable
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // For production: check SITE_URL env var
  const siteUrl = process.env.SITE_URL;
  if (siteUrl && origin === siteUrl) return origin;
  return "";
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = getCorsOrigin(request);
  if (!origin) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
  };
}

function corsPreflightHeaders(request: Request): Record<string, string> {
  const origin = getCorsOrigin(request);
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * POST /api/chat
 *
 * External/fallback HTTP endpoint for triggering a chat completion.
 * The actual streaming happens via DB subscriptions on the client,
 * not via this HTTP response.
 *
 * Requires Authorization: Bearer <token> header.
 * Body: { sessionId: string, model: string, searchPastChats?: boolean }
 * Returns: { messageId: string, cost: number }
 */
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);
    try {
      // Auth is enforced by downstream ctx.runAction which calls requireAuth
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(
          JSON.stringify({ error: "Unauthenticated" }),
          { status: 401, headers }
        );
      }

      const body = (await request.json()) as {
        sessionId: string;
        model: string;
        searchPastChats?: boolean;
      };

      if (!body.sessionId || !body.model) {
        return new Response(
          JSON.stringify({ error: "sessionId and model are required" }),
          { status: 400, headers }
        );
      }

      const result = await ctx.runAction(api.ai.chat, {
        sessionId: body.sessionId as Id<"sessions">,
        model: body.model,
        searchPastChats: body.searchPastChats ?? false,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers,
      });
    }
  }),
});

/**
 * POST /api/extract-memories
 *
 * Trigger memory extraction for a conversation.
 * Requires Authorization: Bearer <token> header.
 * Body: { sessionId: string }
 */
http.route({
  path: "/api/extract-memories",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const headers = corsHeaders(request);
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        return new Response(
          JSON.stringify({ error: "Unauthenticated" }),
          { status: 401, headers }
        );
      }

      const body = (await request.json()) as { sessionId: string; spaceId?: string };

      if (!body.sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId is required" }),
          { status: 400, headers }
        );
      }

      await ctx.runAction(api.summarize.extractMemories, {
        sessionId: body.sessionId as Id<"sessions">,
        spaceId: body.spaceId ? (body.spaceId as Id<"spaces">) : undefined,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers,
      });
    }
  }),
});

/**
 * CORS preflight handlers for /api/* routes.
 */
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: corsPreflightHeaders(request),
    });
  }),
});

http.route({
  path: "/api/extract-memories",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return new Response(null, {
      status: 204,
      headers: corsPreflightHeaders(request),
    });
  }),
});

export default http;
