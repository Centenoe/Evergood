/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as available_models from "../available_models.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as embeddings from "../embeddings.js";
import type * as http from "../http.js";
import type * as memories from "../memories.js";
import type * as messages from "../messages.js";
import type * as models from "../models.js";
import type * as pricing from "../pricing.js";
import type * as providers from "../providers.js";
import type * as research from "../research.js";
import type * as search_perplexity from "../search/perplexity.js";
import type * as search_tavily from "../search/tavily.js";
import type * as sessions from "../sessions.js";
import type * as spaces from "../spaces.js";
import type * as summarize from "../summarize.js";
import type * as usageLogs from "../usageLogs.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  available_models: typeof available_models;
  crons: typeof crons;
  dashboard: typeof dashboard;
  embeddings: typeof embeddings;
  http: typeof http;
  memories: typeof memories;
  messages: typeof messages;
  models: typeof models;
  pricing: typeof pricing;
  providers: typeof providers;
  research: typeof research;
  "search/perplexity": typeof search_perplexity;
  "search/tavily": typeof search_tavily;
  sessions: typeof sessions;
  spaces: typeof spaces;
  summarize: typeof summarize;
  usageLogs: typeof usageLogs;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
