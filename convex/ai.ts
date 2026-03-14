import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { MODELS, calculateCost, makeDynamicModelConfig } from "./models";
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
  },
  handler: async (ctx, { sessionId, model, searchPastChats }): Promise<{ messageId: Id<"messages">; cost: number }> => {
    // Look up model config, or create a dynamic fallback for discovered models
    let modelConfig = MODELS[model];
    if (!modelConfig) {
      // Try to infer the provider from the model ID
      if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4") || model.startsWith("chatgpt-")) {
        modelConfig = makeDynamicModelConfig(model, "openai");
      } else if (model.startsWith("claude-")) {
        modelConfig = makeDynamicModelConfig(model, "anthropic");
      } else if (model.startsWith("sonar")) {
        modelConfig = makeDynamicModelConfig(model, "perplexity");
      } else {
        throw new Error(`Unknown model: ${model}`);
      }
    }

    // 1. Build system prompt from memories
    const memoryBlock = await ctx.runQuery(api.memories.getSystemPromptBlock);
    let systemContent = "You are a helpful AI assistant.";
    if (memoryBlock) {
      systemContent += "\n\n" + memoryBlock;
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

    // 4. Create a streaming placeholder message
    const streamingMessageId = await ctx.runMutation(
      api.messages.startStreaming,
      { sessionId, model }
    );

    // 5. Call the appropriate LLM
    try {
      const result = await callLLM(
        ctx,
        modelConfig,
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

      // 6. Finish streaming with metadata
      const cost = calculateCost(
        model,
        result.inputTokens,
        result.outputTokens
      );
      await ctx.runMutation(api.messages.finishStreaming, {
        messageId: streamingMessageId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: cost,
      });

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

// ─── LLM Call Helpers ────────────────────────────────────────────────

interface LLMResult {
  inputTokens: number;
  outputTokens: number;
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
  modelConfig: (typeof MODELS)[string],
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
  modelConfig: (typeof MODELS)[string],
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
  modelConfig: (typeof MODELS)[string],
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
  modelConfig: (typeof MODELS)[string],
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
              inputTokens = parsed.message?.usage?.input_tokens || 0;
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

  return { inputTokens, outputTokens };
}
