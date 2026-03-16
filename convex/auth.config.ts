import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://helpful-mammoth-87.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
