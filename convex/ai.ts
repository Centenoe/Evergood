import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { inferModelRouting, calculateCost } from "./models";
import type { ModelRouting, OraclePricing } from "./models";
import { requireAuth } from "./auth.helpers";
import type { Id } from "./_generated/dataModel";

/** Minimal context type for helper functions that only need runMutation. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RunMutationCtx {
  runMutation: (func: any, args: any) => Promise<any>;
}

/**
 * Main chat completion action.
 *
 * 1. Fetches memories → builds system prompt
 * 2. Fetches full conversation history
 * 3. Optionally retrieves semantically similar past exchanges
 * 4. Calls the appropriate LLM (Anthropic, OpenAI, Perplexity)
 * 5. Streams response by writing chunks to DB via mutations
 * 6. On completion, saves token counts + cost and schedules embedding
 */
export const chat = action({
  args: {
    sessionId: v.id("sessions"),
    model: v.string(),
    searchPastChats: v.optional(v.boolean()),
    searchProvider: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, model, searchPastChats, searchProvider }): Promise<{ messageId: Id<"messages">; cost: number }> => {
    await requireAuth(ctx);

    // Infer provider routing from the model ID
    const modelRouting = inferModelRouting(model);

    // 1. Build system prompt from memories
    // Get session first to know the space context
    const session = await ctx.runQuery(api.sessions.get, { id: sessionId });
    const spaceId = session?.spaceId;
    const memoryBlock = await ctx.runQuery(api.memories.getSystemPromptBlock, { spaceId });
    let systemContent = "You are a helpful AI assistant.";
    if (memoryBlock) {
      systemContent += "\n\n" + memoryBlock;
    }

    // 1b. Inject Space system prompt if session belongs to a Space
    if (spaceId) {
      const space = await ctx.runQuery(api.spaces.get, { id: spaceId });
      if (space?.systemPrompt) {
        systemContent += "\n\n## Space Context: " + space.name + "\n" + space.systemPrompt;
      }
    }

    // 2. Fetch full conversation history
    const messages = await ctx.runQuery(api.messages.list, { sessionId });
    const nonStreamingMessages = messages.filter(
      (m: { isStreaming?: boolean }) => !m.isStreaming
    );

    // 3. Optionally retrieve semantically similar past exchanges
    if (searchPastChats && nonStreamingMessages.length > 0) {
      const lastUserMessage = [...nonStreamingMessages]
        .reverse()
        .find((m: { role: string }) => m.role === "user");

      if (lastUserMessage) {
        try {
          const similarExchanges = await ctx.runAction(
            api.embeddings.searchSimilar,
            {
              queryText: lastUserMessage.content,
              excludeSessionId: sessionId,
              limit: 3,
            }
          );

          if (similarExchanges.length > 0) {
            systemContent += "\n\n## Relevant Past Conversations\n";
            systemContent +=
              "The following are excerpts from previous conversations that may be relevant:\n\n";
            for (const exchange of similarExchanges) {
              systemContent += `> ${exchange.content}\n\n`;
            }
          }
        } catch {
          // Silently skip if embedding/search fails (e.g., no API key)
        }
      }
    }

    // 3b. Web search augmentation (if enabled)
    let searchCitations: string[] = [];
    if (searchProvider && searchProvider !== "off") {
      const lastUserMessage = [...nonStreamingMessages]
        .reverse()
        .find((m: { role: string }) => m.role === "user");

      if (lastUserMessage) {
        try {
          if (searchProvider === "perplexity") {
            const searchResult = await ctx.runAction(
              api.search.perplexity.search,
              { query: lastUserMessage.content, model: "sonar" }
            );
            if (searchResult.citations.length > 0) {
              searchCitations = searchResult.citations;
              systemContent +=
                "\n\n## Web Search Results (via Perplexity)\n" +
                "Use the following web search results to inform your answer. " +
                "Cite sources using [1], [2], etc. format.\n\n" +
                searchResult.content;
            }
          } else if (searchProvider === "tavily") {
            const searchResult = await ctx.runAction(
              api.search.tavily.search,
              { query: lastUserMessage.content }
            );
            if (searchResult.results.length > 0) {
              searchCitations = searchResult.results.map(
                (r: { url: string }) => r.url
              );
              systemContent +=
                "\n\n## Web Search Results (via Tavily)\n" +
                "Use the following web search results to inform your answer. " +
                "Cite sources using [1], [2], etc. format.\n\n";
              for (let i = 0; i < searchResult.results.length; i++) {
                const r = searchResult.results[i];
                systemContent += `[${i + 1}] ${r.title}\n${r.url}\n${r.content}\n\n`;
              }
            }
          }
        } catch {
          // Silently skip if web search fails
        }
      }
    }

    // 4. Create a streaming placeholder message
    const streamingMessageId = await ctx.runMutation(
      api.messages.startStreaming,
      { sessionId, model }
    );

    // 5. Call the appropriate LLM
    try {
      const result = await callLLM(
        ctx,
        modelRouting,
        systemContent,
        nonStreamingMessages.map(
          (m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })
        ),
        streamingMessageId,
        model
      );

      // 6. Snapshot-on-write: lookup Oracle pricing, calculate cost, save to message
      let oraclePricing: OraclePricing | null = null;
      try {
        const pricingRow = await ctx.runQuery(api.pricing.getModelPricing, { modelId: model });
        if (pricingRow) {
          oraclePricing = {
            prompt: pricingRow.prompt,
            completion: pricingRow.completion,
            input_cache_read: pricingRow.input_cache_read ?? undefined,
            input_cache_write: pricingRow.input_cache_write ?? undefined,
            web_search: pricingRow.web_search ?? undefined,
          };
        }
      } catch {
        // Pricing lookup failure is non-critical — fallback to hardcoded
      }

      const cost = calculateCost(
        result.inputTokens,
        result.outputTokens,
        oraclePricing,
        {
          cacheReadTokens: result.cacheReadTokens,
          cacheWriteTokens: result.cacheWriteTokens,
        }
      );
      await ctx.runMutation(api.messages.finishStreaming, {
        messageId: streamingMessageId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: cost,
        citations: searchCitations.length > 0 ? searchCitations : undefined,
        searchProvider: searchProvider && searchProvider !== "off" ? searchProvider : undefined,
      });

      // 6b. Log usage for the cost dashboard
      try {
        await ctx.runMutation(api.usageLogs.insert, {
          sessionId,
          spaceId: spaceId ?? undefined,
          model,
          feature: searchProvider && searchProvider !== "off" ? `chat+${searchProvider}` : "chat",
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: cost,
        });
      } catch {
        // Usage logging is non-critical
      }

      // 7. Schedule embedding for the user message and assistant response
      const lastUserMessage = [...nonStreamingMessages]
        .reverse()
        .find((m: { role: string }) => m.role === "user");
      if (lastUserMessage) {
        try {
          await ctx.runAction(api.embeddings.embedMessage, {
            messageId: lastUserMessage._id,
          });
        } catch {
          // Skip if embedding fails
        }
      }
      try {
        await ctx.runAction(api.embeddings.embedMessage, {
          messageId: streamingMessageId,
        });
      } catch {
        // Skip if embedding fails
      }

      return { messageId: streamingMessageId, cost };
    } catch (error) {
      // On error, update the streaming message with the error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      await ctx.runMutation(api.messages.updateStreamingContent, {
        messageId: streamingMessageId,
        contentChunk: `\n\n**Error:** ${errorMessage}`,
      });
      await ctx.runMutation(api.messages.finishStreaming, {
        messageId: streamingMessageId,
      });
      throw error;
    }
  },
});

/**
 * Generate a session title from the first message using a cheap model.
 */
export const generateTitle = action({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await requireAuth(ctx);

    const messages = await ctx.runQuery(api.messages.list, { sessionId });
    const firstUserMessage = messages.find(
      (m: { role: string }) => m.role === "user"
    );

    if (!firstUserMessage) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content:
                  'Generate a concise title (max 6 words) for a conversation that starts with the following message. Return ONLY the title, no quotes or punctuation.',
              },
              { role: "user", content: firstUserMessage.content },
            ],
            max_tokens: 20,
          }),
        }
      );

      if (!response.ok) return;

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const title = data.choices?.[0]?.message?.content?.trim();
      if (title) {
        await ctx.runMutation(api.sessions.updateTitle, {
          id: sessionId,
          title,
        });
      }
    } catch {
      // Silently fail — title generation is a nice-to-have
    }
  },
});

/**
 * Temp chat action — calls the LLM without writing anything to the database.
 * Returns the full response text + token counts. No usage logging.
 */
export const tempChat = action({
  args: {
    model: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  },
  handler: async (
    ctx,
    { model, messages }
  ): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }> => {
    await requireAuth(ctx);

    const modelRouting = inferModelRouting(model);

    const systemContent = "You are a helpful AI assistant.";
    const result = await callLLMNonStreaming(
      modelRouting,
      systemContent,
      messages
    );

    let oraclePricing: OraclePricing | null = null;
    try {
      const pricingRow = await ctx.runQuery(api.pricing.getModelPricing, { modelId: model });
      if (pricingRow) {
        oraclePricing = {
          prompt: pricingRow.prompt,
          completion: pricingRow.completion,
          input_cache_read: pricingRow.input_cache_read ?? undefined,
          input_cache_write: pricingRow.input_cache_write ?? undefined,
          web_search: pricingRow.web_search ?? undefined,
        };
      }
    } catch {
      // Non-critical
    }

    const costUsd = calculateCost(result.inputTokens, result.outputTokens, oraclePricing);
    return {
      content: result.content,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd,
    };
  },
});

// ─── LLM Call Helpers ────────────────────────────────────────────────

interface LLMResult {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Route to the correct provider and stream the response.
 */
async function callLLM(
  ctx: RunMutationCtx,
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[],
  streamingMessageId: string,
  _modelName: string
): Promise<LLMResult> {
  switch (modelConfig.provider) {
    case "anthropic":
      return callAnthropic(
        ctx,
        modelConfig,
        systemContent,
        chatHistory,
        streamingMessageId
      );
    case "openai":
      return callOpenAI(
        ctx,
        modelConfig,
        systemContent,
        chatHistory,
        streamingMessageId
      );
    case "perplexity":
      return callPerplexity(
        ctx,
        modelConfig,
        systemContent,
        chatHistory,
        streamingMessageId
      );
    default:
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }
}

/**
 * Call the Anthropic Messages API with streaming.
 */
async function callAnthropic(
  ctx: RunMutationCtx,
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[],
  streamingMessageId: string
): Promise<LLMResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Add it in the Convex Dashboard → Settings → Environment Variables."
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelConfig.apiModel,
      max_tokens: 8192,
      system: systemContent,
      messages: chatHistory,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  return await processSSEStream(
    response,
    ctx,
    streamingMessageId,
    "anthropic"
  );
}

/**
 * Call the OpenAI Chat Completions API with streaming.
 */
async function callOpenAI(
  ctx: RunMutationCtx,
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[],
  streamingMessageId: string
): Promise<LLMResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY not configured. Add it in the Convex Dashboard → Settings → Environment Variables."
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.apiModel,
        messages: [
          { role: "system", content: systemContent },
          ...chatHistory,
        ],
        stream: true,
        stream_options: { include_usage: true },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  return await processSSEStream(response, ctx, streamingMessageId, "openai");
}

/**
 * Call the Perplexity API with streaming (OpenAI-compatible format).
 */
async function callPerplexity(
  ctx: RunMutationCtx,
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[],
  streamingMessageId: string
): Promise<LLMResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PERPLEXITY_API_KEY not configured. Add it in the Convex Dashboard → Settings → Environment Variables."
    );
  }

  const response = await fetch(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelConfig.apiModel,
        messages: [
          { role: "system", content: systemContent },
          ...chatHistory,
        ],
        stream: true,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${error}`);
  }

  return await processSSEStream(
    response,
    ctx,
    streamingMessageId,
    "perplexity"
  );
}

// ─── SSE Stream Parser ──────────────────────────────────────────────

/**
 * Parse an SSE stream from any provider and write chunks to DB.
 * Batches chunks to reduce DB mutation frequency.
 */
async function processSSEStream(
  response: Response,
  ctx: RunMutationCtx,
  streamingMessageId: string,
  provider: "anthropic" | "openai" | "perplexity"
): Promise<LLMResult> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let contentBuffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;

  // Batch writes: flush every ~200ms or 50 chars
  const BATCH_CHAR_THRESHOLD = 50;
  let lastFlushTime = Date.now();
  const FLUSH_INTERVAL_MS = 200;

  const flushBuffer = async () => {
    if (contentBuffer.length > 0) {
      await ctx.runMutation(api.messages.updateStreamingContent, {
        messageId: streamingMessageId,
        contentChunk: contentBuffer,
      });
      contentBuffer = "";
      lastFlushTime = Date.now();
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);

          if (provider === "anthropic") {
            // Anthropic event types
            if (parsed.type === "content_block_delta") {
              contentBuffer += parsed.delta?.text || "";
            } else if (parsed.type === "message_delta") {
              outputTokens = parsed.usage?.output_tokens || outputTokens;
            } else if (parsed.type === "message_start") {
              const usage = parsed.message?.usage;
              inputTokens = usage?.input_tokens || 0;
              // Anthropic cache token fields
              cacheReadTokens = usage?.cache_read_input_tokens || 0;
              cacheWriteTokens = usage?.cache_creation_input_tokens || 0;
            }
          } else {
            // OpenAI / Perplexity format
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              contentBuffer += delta.content;
            }
            // OpenAI stream_options: include_usage sends usage in the last chunk
            if (parsed.usage) {
              inputTokens = parsed.usage.prompt_tokens || 0;
              outputTokens = parsed.usage.completion_tokens || 0;
              // OpenAI cache tokens (if present)
              if (parsed.usage.prompt_tokens_details) {
                cacheReadTokens = parsed.usage.prompt_tokens_details.cached_tokens || 0;
              }
            }
          }
        } catch {
          // Skip malformed JSON lines
        }

        // Flush if buffer is large enough or enough time has passed
        if (
          contentBuffer.length >= BATCH_CHAR_THRESHOLD ||
          Date.now() - lastFlushTime >= FLUSH_INTERVAL_MS
        ) {
          await flushBuffer();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Final flush
  await flushBuffer();

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: cacheReadTokens > 0 ? cacheReadTokens : undefined,
    cacheWriteTokens: cacheWriteTokens > 0 ? cacheWriteTokens : undefined,
  };
}

// ─── Non-Streaming LLM Call (for temp chats) ─────────────────────────

interface NonStreamingResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Call the LLM without streaming. Returns the full response at once.
 * Used by temp chats to avoid writing to the database.
 */
async function callLLMNonStreaming(
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[]
): Promise<NonStreamingResult> {
  switch (modelConfig.provider) {
    case "anthropic":
      return callAnthropicNonStreaming(modelConfig, systemContent, chatHistory);
    case "openai":
      return callOpenAINonStreaming(modelConfig, systemContent, chatHistory);
    case "perplexity":
      return callPerplexityNonStreaming(modelConfig, systemContent, chatHistory);
    default:
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }
}

async function callAnthropicNonStreaming(
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[]
): Promise<NonStreamingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelConfig.apiModel,
      max_tokens: 8192,
      system: systemContent,
      messages: chatHistory,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");

  return {
    content,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAINonStreaming(
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[]
): Promise<NonStreamingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelConfig.apiModel,
      messages: [
        { role: "system", content: systemContent },
        ...chatHistory,
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callPerplexityNonStreaming(
  modelConfig: ModelRouting,
  systemContent: string,
  chatHistory: ChatMessage[]
): Promise<NonStreamingResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not configured.");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelConfig.apiModel,
      messages: [
        { role: "system", content: systemContent },
        ...chatHistory,
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
