import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";

const slug = "tarkwa-farmer-trader-visit-learnings";
const defaultSiteUrl = "https://kuapadwaso.com";

function publicSiteOrigin(value: string | undefined): string {
  const url = new URL(value ?? defaultSiteUrl);
  const isLocalhost =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocalhost) {
    throw new Error("siteUrl must use HTTPS, except for localhost previews.");
  }
  return url.origin;
}

function imageUrl(origin: string, filename: string): string {
  return `${origin}/stories/tarkwa-market-visit/${filename}`;
}

function storyContent(origin: string): Doc<"blogPosts">["content"] {
  return [
    {
      id: "introduction-1",
      type: "paragraph",
      content: [
        {
          text: "Kuapa Dwaso means Farmer's Market in Akan. The idea behind it is simple: farmers should be able to find reliable buyers, and buyers should be able to count on dependable produce.",
        },
      ],
    },
    {
      id: "introduction-2",
      type: "paragraph",
      content: [
        {
          text: "But a simple idea is not the same as a correct one. Before shaping the platform, we wanted to hear from the people who live this problem every day. In July 2026, Kuapa Dwaso team members Catherine Bruce Vochere and Hannah Nankon Gyekyiwaa travelled to Tarkwa in Ghana's Western Region and visited the market near the University of Mines and Technology twice.",
        },
      ],
    },
    {
      id: "introduction-3",
      type: "paragraph",
      content: [
        {
          text: "On Wednesday, 1 July, they spent time with traders, asking how they source produce, what frustrates them, and what happens to food before it reaches their stalls. On Friday, 3 July, one of Tarkwa's market days, they returned to meet farmers who had travelled in to sell their harvest.",
        },
      ],
    },
    {
      id: "introduction-quote",
      type: "quote",
      content: [
        {
          text: "Those two days changed how we think about the problem we are solving.",
          marks: ["bold"],
        },
      ],
    },
    {
      id: "editorial-update-2026-09-12",
      type: "paragraph",
      content: [{ text: "Editorial update — 12 September 2026: this story preserves what we learned during the visits. Kuapa Dwaso's first software pilot now starts with commercial maize demand and verified farmer supply; it does not depend on a Kuapa Dwaso-operated warehouse. Any future storage or warehouse investment remains conditional on transaction evidence." }],
    },
    {
      id: "long-road-heading",
      type: "heading2",
      content: [{ text: "The long road to market" }],
    },
    {
      id: "long-road-1",
      type: "paragraph",
      content: [
        {
          text: "The first thing traders wanted to talk about was transport. Produce rarely travels straight from a farm to a market like the one in Tarkwa. Many farms sit far from good roads, so a harvest may first be carried by hand to a point a tricycle can reach. The tricycle takes it to another point, where it can finally be loaded onto a truck for the longer journey into town.",
        },
      ],
    },
    {
      id: "long-road-quote",
      type: "quote",
      content: [
        {
          text: "Farm or village, then manual carrying, then a tricycle, then a truck, then the city market.",
        },
      ],
    },
    {
      id: "long-road-2",
      type: "paragraph",
      content: [
        {
          text: "Every stage costs money. Every stage is also a chance for delay, rough handling, or spoilage. By the time produce reaches a stall in Tarkwa, it has already paid its way through several hands, and those costs appear in the final price.",
        },
      ],
    },
    {
      id: "long-road-3",
      type: "paragraph",
      content: [
        {
          text: "Many of the traders we met do not buy directly from farmers. They buy from other traders and middlemen. That extra distance between the person who grows the food and the person who sells it makes life harder for both sides. Traders struggle to secure predictable supply, while farmers struggle to see where dependable demand really exists.",
        },
      ],
    },
    {
      id: "market-conversation-image",
      type: "image",
      url: imageUrl(origin, "tarkwa-market-conversation.webp"),
      alt: "Kuapa Dwaso team members seated beside cassava and plantain while speaking with a trader in Tarkwa",
      caption:
        "Listening at the produce stall helped the team trace the costs and uncertainty behind each journey to market.",
    },
    {
      id: "farmer-exposed-heading",
      type: "heading2",
      content: [{ text: "The farmer arrives already exposed" }],
    },
    {
      id: "farmer-exposed-1",
      type: "paragraph",
      content: [
        {
          text: "The Friday visit showed us the same supply chain from the other end. A farmer can harvest, pay for every stage of the transport journey, and arrive at the market without a confirmed buyer waiting. At that point the money is already spent. If the produce is perishable, the clock is ticking and there is very little room to negotiate.",
        },
      ],
    },
    {
      id: "farmer-exposed-2",
      type: "paragraph",
      content: [
        {
          text: "Farmers told us that some traders do not have cash on hand when produce arrives. The farmer then faces a hard choice: take the produce home, which rarely makes financial sense, or hand it over and hope to be paid later. That weak position can lead to low prices or informal credit arrangements the farmer never truly chose.",
        },
      ],
    },
    {
      id: "farmer-exposed-3",
      type: "paragraph",
      content: [
        {
          text: "This shifted our understanding. The problem is not simply that farmers and buyers cannot find one another. The deeper problem is that produce can begin a costly journey without a dependable process, leaving the farmer to carry most of the risk.",
        },
      ],
    },
    {
      id: "trust-point-heading",
      type: "heading2",
      content: [{ text: "A trust point closer to the farm" }],
    },
    {
      id: "trust-point-1",
      type: "paragraph",
      content: [
        {
          text: "Those lessons now shape the maize pilot we are preparing. A commercial buyer records a requirement first. Farmers can then declare matching maize, review the exact offer, and decide before collection. Quality, quantity, custody, delivery, payment obligations, and settlement stay visible without requiring a warehouse row.",
        },
      ],
    },
    {
      id: "trust-point-2",
      type: "paragraph",
      content: [
        {
          text: "Commercial buyers request a maize type, quantity, quality specification, destination, delivery window, and payment expectation. Confirmed farmer offers are quality checked and combined only for that requirement. This does not remove every agricultural risk, but it replaces an improvised city-market journey with a visible transaction and named responsibility.",
        },
      ],
    },
    {
      id: "reliability-heading",
      type: "heading2",
      content: [{ text: "Both sides need someone they can count on" }],
    },
    {
      id: "reliability-1",
      type: "paragraph",
      content: [
        {
          text: "It would be easy to frame this as farmers versus traders, but that is not what we saw. Both sides are dealing with the same underlying issue: unreliability.",
        },
      ],
    },
    {
      id: "reliability-2",
      type: "paragraph",
      content: [
        {
          text: "Buyers need confidence that committed quantity passes the agreed quality checks and reaches the named destination in the agreed window. Farmers need readable offers, transparent deductions, collection records, and evidence of any payment made. The pilot software records those stages separately; it does not claim that a payment succeeded before reconciliation.",
        },
      ],
    },
    {
      id: "reliability-quote",
      type: "quote",
      content: [
        {
          text: "Produce should move through a process people can see and trust—not on hope alone.",
          marks: ["bold"],
        },
      ],
    },
    {
      id: "smartphone-heading",
      type: "heading2",
      content: [{ text: "The assumption we got wrong" }],
    },
    {
      id: "smartphone-1",
      type: "paragraph",
      content: [
        {
          text: "The Friday conversations also corrected us on something we thought we knew. We assumed most farmers would not have smartphones, so we initially considered USSD or SMS commands as the main way to use Kuapa Dwaso. In Tarkwa, many farmers told us that they either owned a smartphone or lived with someone who could help them use one.",
        },
      ],
    },
    {
      id: "smartphone-2",
      type: "paragraph",
      content: [
        {
          text: "That does not mean every farmer in every community has reliable smartphone access. It does mean a lightweight smartphone-first experience is a practical starting point. Farmers can register directly or with assistance, while concise SMS updates communicate receipts, fees, sale status, dispatches, and payments without requiring them to remain online.",
        },
      ],
    },
    {
      id: "smartphone-3",
      type: "paragraph",
      content: [
        {
          text: "We will keep testing this assumption as the pilot reaches participating communities. If the evidence shows a real need for USSD or another offline channel, we will build it from observed use rather than from assumptions made in a planning meeting.",
        },
      ],
    },
    {
      id: "inputs-heading",
      type: "heading2",
      content: [{ text: "Problems that start before the harvest" }],
    },
    {
      id: "inputs-1",
      type: "paragraph",
      content: [
        {
          text: "Farmers also spoke about the rising cost of inputs such as fertiliser. It was a useful reminder that their challenges begin long before produce reaches any warehouse or market.",
        },
      ],
    },
    {
      id: "inputs-2",
      type: "paragraph",
      content: [
        {
          text: "Kuapa Dwaso cannot solve everything at once. Input financing and credit remain outside the initial scope. For now, the focus is deliberately narrower: trustworthy intake, clear inventory records, verified stock for buyers, and coordinated market delivery.",
        },
      ],
    },
    {
      id: "takeaways-heading",
      type: "heading2",
      content: [{ text: "What Tarkwa changed for us" }],
    },
    {
      id: "takeaways-list",
      type: "bulletList",
      items: [
        [
          {
            text: "Farmers need a nearby, accountable alternative to carrying produce blindly to a city market.",
          },
        ],
        [
          {
            text: "Every stored batch needs a clear owner, weight, grade, status, and fee record.",
          },
        ],
        [
          {
            text: "Commercial buyer requirements should be explicit before farmer offers or collection plans are confirmed.",
          },
        ],
        [
          {
            text: "Confirmed orders should travel together in quantities that make commercial sense.",
          },
        ],
        [
          {
            text: "Payment terms and quality expectations must be visible before a sale is completed.",
          },
        ],
        [
          {
            text: "Buyers need verified, dependable stock rather than hopeful listings.",
          },
        ],
        [
          {
            text: "A smartphone-first service can work alongside assisted access and one-way SMS updates.",
          },
        ],
        [
          {
            text: "Future storage and warehouse decisions must follow evidence from real transactions, not registration counts or projections.",
          },
        ],
      ],
    },
    {
      id: "gallery-heading",
      type: "heading2",
      content: [{ text: "Scenes from the visit" }],
    },
    {
      id: "tarkwa-gallery",
      type: "gallery",
      images: [
        {
          url: imageUrl(origin, "tarkwa-produce-and-team.webp"),
          alt: "Kuapa Dwaso team members and a trader standing beside cassava and plantain at the Tarkwa market",
          caption: "The team with a trader beside locally sold produce.",
        },
        {
          url: imageUrl(origin, "tarkwa-market-stall.webp"),
          alt: "A Tarkwa produce stall displaying plantain, cassava, peppers, garden eggs, and cocoyam",
          caption:
            "The variety at one stall reflects the coordination required before produce reaches buyers.",
        },
        {
          url: imageUrl(origin, "tarkwa-produce-stall-visit.webp"),
          alt: "Kuapa Dwaso team members with two traders at a produce stall in Tarkwa",
          caption:
            "Field conversations grounded the product in daily market realities.",
        },
        {
          url: imageUrl(origin, "tarkwa-team-and-trader.webp"),
          alt: "Two Kuapa Dwaso team members standing with a trader under market umbrellas in Tarkwa",
          caption: "Relationships and trust remain central to the work ahead.",
        },
      ],
    },
    {
      id: "still-listening-heading",
      type: "heading2",
      content: [{ text: "Still listening" }],
    },
    {
      id: "still-listening-1",
      type: "paragraph",
      content: [
        {
          text: "These visits did not answer every question. What they did was hand us better ones: Which buyers have dependable maize demand? What quantity makes a collection and delivery worthwhile? Which quality standards decide whether produce is accepted? How can custody and payment records earn trust over time?",
        },
      ],
    },
    {
      id: "still-listening-2",
      type: "paragraph",
      content: [
        {
          text: "Those questions continue to guide the pilot. Kuapa Dwaso is being built from the experiences of farmers, traders, buyers, warehouse operators, transporters, and agricultural partners—not from what we imagine the market needs.",
        },
      ],
    },
    {
      id: "still-listening-3",
      type: "paragraph",
      content: [
        {
          text: "By listening first and improving through real transactions, we hope to build a Farmer's Market worthy of the name: one that gives farmers clearer records and stronger choices, while giving buyers a dependable route to verified produce.",
        },
      ],
    },
  ];
}

async function resolveActor(
  ctx: MutationCtx,
  actorUserId: Id<"users"> | undefined,
): Promise<Doc<"users">> {
  if (actorUserId !== undefined) {
    const actor = await ctx.db.get(actorUserId);
    if (actor === null || actor.role !== "admin" || actor.status !== "active") {
      throw new Error("actorUserId must identify an active admin user.");
    }
    return actor;
  }

  const assignments = await ctx.db
    .query("adminRoleAssignments")
    .withIndex("by_role_status", (q) =>
      q.eq("roleKey", "platform_owner").eq("status", "active"),
    )
    .collect();
  const now = Date.now();
  const eligible = assignments
    .filter(
      (assignment) =>
        assignment.scopeType === "global" &&
        (assignment.expiresAt === undefined || assignment.expiresAt > now),
    )
    .sort((a, b) => a.assignedAt - b.assignedAt);

  for (const assignment of eligible) {
    const actor = await ctx.db.get(assignment.adminUserId);
    if (actor?.role === "admin" && actor.status === "active") return actor;
  }

  throw new Error(
    "No active global platform owner was found. Pass actorUserId explicitly.",
  );
}

/**
 * Publishes the first Kuapa Dwaso field story from docs/blog-drafts/blog1.md.
 *
 * Usage:
 *   npx convex run seedFirstBlog:seed '{"dryRun":true}'
 *   npx convex run seedFirstBlog:seed
 *   npx convex run seedFirstBlog:seed '{"siteUrl":"http://localhost:3000"}'
 *
 * Idempotent: an existing post with the same slug is updated in place.
 */
export const seed = internalMutation({
  args: {
    actorUserId: v.optional(v.id("users")),
    dryRun: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
    expectedExistingId: v.optional(v.id("blogPosts")),
    expectedExistingUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const origin = publicSiteOrigin(args.siteUrl);
    const existing = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const action = existing === null ? "insert" : "update";

    if (args.dryRun === true) {
      return { action: `would-${action}`, slug, siteUrl: origin, blogPostId: existing?._id, currentUpdatedAt: existing?.updatedAt };
    }

    if (existing !== null && (args.expectedExistingId !== existing._id || args.expectedExistingUpdatedAt !== existing.updatedAt))
      throw new Error("Existing story changed. Run the dry-run again and pass its exact blogPostId and currentUpdatedAt.");

    const actor = await resolveActor(ctx, args.actorUserId);
    const now = Date.now();
    const fields = {
      title:
        "Listening Before Building: What Farmers and Traders in Tarkwa Taught Us",
      slug,
      excerpt:
        "Two Tarkwa market visits revealed the risks farmers carry and helped shape Kuapa Dwaso's demand-led maize pilot, transparent terms, quality checks, and accountable delivery approach.",
      category: "visits" as const,
      status: "published" as const,
      content: storyContent(origin),
      heroImageUrl: imageUrl(origin, "tarkwa-listening-session.webp"),
      heroImageAlt:
        "Two Kuapa Dwaso team members listening to a trader at a produce market in Tarkwa",
      heroImageCaption:
        "Kuapa Dwaso team members listen to a trader during the July 2026 field visit in Tarkwa.",
      authorName: "Kuapa Dwaso Team",
      location: "Tarkwa, Tarkwa-Nsuaem Municipality, Western Region, Ghana",
      occurredAt: Date.UTC(2026, 6, 1),
      publishedAt: existing?.publishedAt ?? now,
      publishedByUserId: actor._id,
      updatedByUserId: actor._id,
      updatedAt: now,
    };

    if (existing !== null) {
      await ctx.db.patch(existing._id, fields);
      return { action, blogPostId: existing._id, slug, siteUrl: origin };
    }

    const blogPostId = await ctx.db.insert("blogPosts", {
      ...fields,
      createdByUserId: actor._id,
      createdAt: now,
    });
    return { action, blogPostId, slug, siteUrl: origin };
  },
});
