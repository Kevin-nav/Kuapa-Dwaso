import { query } from "./_generated/server";
import { v } from "convex/values";

export const status = query({
  args: {},
  returns: v.object({
    service: v.literal("kuapa-dwaso-convex"),
    ok: v.literal(true)
  }),
  handler: () => ({
    service: "kuapa-dwaso-convex",
    ok: true
  })
});
