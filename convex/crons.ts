import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh model pricing from OpenRouter daily at 04:15 UTC.
// Offset from midnight to avoid global traffic spikes.
crons.daily(
  "refresh model pricing",
  { hourUTC: 4, minuteUTC: 15 },
  internal.pricing.fetchPricing
);

export default crons;
