import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/**
 * POST /api/chat
 *
 * External/fallback HTTP endpoint for triggering a chat completion.
 * The actual streaming happens via DB subscriptions on the client,
 * not via this HTTP response.
 *
 * Body: { sessionId: string, model: string, searchPastChats?: boolean }
 * Returns: { messageId: string, cost: number }
 */
http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = (await request.json()) as {
        sessionId: string;
        model: string;
        searchPastChats?: boolean;
      };

      if (!body.sessionId || !body.model) {
        return new Response(
          JSON.stringify({ error: "sessionId and model are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await ctx.runAction(api.ai.chat, {
        sessionId: body.sessionId as any,
        model: body.model,
        searchPastChats: body.searchPastChats ?? false,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * POST /api/extract-memories
 *
 * Trigger memory extraction for a conversation.
 * Body: { sessionId: string }
 */
http.route({
  path: "/api/extract-memories",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = (await request.json()) as { sessionId: string };

      if (!body.sessionId) {
        return new Response(
          JSON.stringify({ error: "sessionId is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await ctx.runAction(api.summarize.extractMemories, {
        sessionId: body.sessionId as any,
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal server error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * CORS preflight handler for all /api/* routes.
 */
http.route({
  path: "/api/chat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

http.route({
  path: "/api/extract-memories",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
