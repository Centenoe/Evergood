import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Extract durable facts (memories) from a conversation using a cheap model.
 *
 * Called after a conversation ends (or manually triggered).
 * Uses gpt-4o-mini to extract 0–3 facts, then upserts them into the memories table.
 */
export const extractMemories = action({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY not configured. Add it in the Convex Dashboard → Settings → Environment Variables."
      );
    }

    // Fetch all messages for this session
    const messages = await ctx.runQuery(api.messages.list, { sessionId });
    if (messages.length === 0) return;

    // Build a condensed transcript (limit to ~4000 chars to keep costs low)
    const transcript = messages
      .filter((m: { role: string }) => m.role !== "system")
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

    const systemPrompt = `You are analyzing a conversation to extract durable facts about the user.
Extract 0 to 3 facts that would be useful to remember for future conversations.
Focus on: tech stack, projects, preferences, work style, goals, personal info the user shares.

Do NOT extract:
- Temporary or conversation-specific context
- Facts that are too vague to be useful
- Anything already obvious from the conversation topic

Return a JSON array of objects with "category" and "content" fields.
Categories should be one of: "stack", "project", "preference", "work", "personal", "goal"

Example output:
[
  {"category": "stack", "content": "Uses Tauri 2.x + SvelteKit + Convex for desktop apps"},
  {"category": "preference", "content": "Prefers dark mode and minimal UI design"}
]

If there are no durable facts worth extracting, return an empty array: []
Return ONLY the JSON array, no other text.`;

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
              { role: "system", content: systemPrompt },
              { role: "user", content: transcript },
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const rawContent = data.choices?.[0]?.message?.content?.trim();
      if (!rawContent) return;

      // Parse the JSON response
      let facts: Array<{ category: string; content: string }>;
      try {
        facts = JSON.parse(rawContent);
      } catch {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return;
        facts = JSON.parse(jsonMatch[0]);
      }

      if (!Array.isArray(facts) || facts.length === 0) return;

      // Upsert each extracted fact
      for (const fact of facts.slice(0, 3)) {
        if (
          fact.category &&
          fact.content &&
          typeof fact.category === "string" &&
          typeof fact.content === "string"
        ) {
          await ctx.runMutation(api.memories.upsert, {
            category: fact.category,
            content: fact.content,
            confidence: 0.7,
          });
        }
      }
    } catch (error) {
      // Log but don't throw — memory extraction is a background enhancement
      console.error("Memory extraction failed:", error);
    }
  },
});
