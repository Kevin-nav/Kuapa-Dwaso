import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";

const slug = "extech-agricultural-services-visit";
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
  return `${origin}/stories/extech-visit/${filename}`;
}

function storyContent(origin: string): Doc<"blogPosts">["content"] {
  return [
    {
      id: "introduction-1",
      type: "paragraph",
      content: [
        {
          text: "On Friday, 7 August 2026, Kuapa Dwaso representatives Catherine Bruce Vuochere and Kevin Amisom Nchorbuno spent the day with the team at Extech Agricultural Services in Takoradi.",
        },
      ],
    },
    {
      id: "introduction-2",
      type: "paragraph",
      content: [
        {
          text: "We went with one goal: to learn from people already doing the work we were preparing to do. There is only so much an agricultural business can learn from a desk. Some lessons come only from sitting with people who understand the market, then walking through the places where produce is received, handled, stored, and prepared.",
        },
      ],
    },
    {
      id: "introduction-3",
      type: "paragraph",
      content: [
        {
          text: "The Extech team welcomed us, answered our questions openly, and took us through a warehouse storing maize. The most important lesson was not simply that warehouse infrastructure matters. It was that a warehouse creates value only when it sits inside a dependable network of farmers, buyers, operators, transporters, and clear records.",
        },
      ],
    },
    {
      id: "introduction-quote",
      type: "quote",
      content: [
        {
          text: "The visit helped turn the warehouse from an idea about a building into a model for trust and coordination.",
          marks: ["bold"],
        },
      ],
    },
    {
      id: "network-heading",
      type: "heading2",
      content: [{ text: "Start with the network, not a new building" }],
    },
    {
      id: "network-1",
      type: "paragraph",
      content: [
        {
          text: "Before this visit, constructing our own warehouse felt like a natural first step. Store produce, then find buyers. The day at Extech showed us why beginning with a new building would put capital ahead of evidence. A warehouse requires staff, security, maintenance, utilities, disciplined inventory control, and enough activity to justify those costs.",
        },
      ],
    },
    {
      id: "network-2",
      type: "paragraph",
      content: [
        {
          text: "That lesson still guides us, but our model has developed since the visit. Kuapa Dwaso now begins with participating community warehouses and experienced partners instead of constructing a facility of its own. Farmers gain a nearby point for intake and storage, while the platform connects recorded stock to buyer orders and scheduled market delivery.",
        },
      ],
    },
    {
      id: "network-3",
      type: "paragraph",
      content: [
        {
          text: "We did not move away from warehouses. We became clearer about how to use them: start with existing local capacity, build dependable operating habits, measure real demand, and let evidence determine where additional infrastructure is eventually justified.",
        },
      ],
    },
    {
      id: "processing-equipment-image",
      type: "image",
      url: imageUrl(origin, "extech-processing-equipment.webp"),
      alt: "Kuapa Dwaso representatives viewing maize handling and processing equipment inside a warehouse in Takoradi",
      caption:
        "The warehouse tour made the physical requirements of handling, storage, and preparation tangible.",
    },
    {
      id: "operating-system-heading",
      type: "heading2",
      content: [{ text: "A warehouse is an operating system" }],
    },
    {
      id: "operating-system-1",
      type: "paragraph",
      content: [
        {
          text: "Seeing maize in storage reinforced that the building is only one part of the work. Every batch needs an owner. Its quantity and condition need to be known. The people handling it need defined responsibilities. Storage fees, reservations, sales, and dispatches need records that everyone can follow.",
        },
      ],
    },
    {
      id: "operating-system-2",
      type: "paragraph",
      content: [
        {
          text: "That is what Kuapa Dwaso is putting into practice today. At intake, warehouse agents weigh, grade, photograph, and record produce. Farmers receive storage receipts. Inventory remains tied to its owner and location, and its status changes visibly as stock becomes available, reserved, sold, or dispatched.",
        },
      ],
    },
    {
      id: "buyer-heading",
      type: "heading2",
      content: [{ text: "Know the buyer before confirmed orders move" }],
    },
    {
      id: "buyer-1",
      type: "paragraph",
      content: [
        {
          text: "Another lesson stayed with us: storage does not create demand by itself. Buyer requirements still need to be explicit before an order is prepared and dispatched.",
        },
      ],
    },
    {
      id: "buyer-list",
      type: "bulletList",
      items: [
        [{ text: "The crop, variety, quantity, and quality required." }],
        [{ text: "The destination and scheduled delivery day." }],
        [{ text: "The published order cutoff and payment deadline." }],
        [{ text: "The price, applicable fees, and fulfilment conditions." }],
        [{ text: "The people responsible for preparation and dispatch." }],
      ],
    },
    {
      id: "buyer-2",
      type: "paragraph",
      content: [
        {
          text: "Traders and bulk buyers therefore order from verified warehouse stock before a published cutoff. Confirmed orders are aggregated for a dated run and prepared for scheduled delivery to selected destinations. Farmers keep clear ownership and sale records, while buyers gain confidence that the stock they order has been received and checked.",
        },
      ],
    },
    {
      id: "partners-heading",
      type: "heading2",
      content: [{ text: "Why we are not starting alone" }],
    },
    {
      id: "partners-1",
      type: "paragraph",
      content: [
        {
          text: "Agriculture is not a sector anyone walks into cold. Existing operators hold years of market knowledge, farmer relationships, buyer connections, and practical experience with the problems that are difficult to see from outside.",
        },
      ],
    },
    {
      id: "partners-2",
      type: "paragraph",
      content: [
        {
          text: "The Extech team's advice was practical: learn alongside experienced partners, complete real transactions, and build capacity step by step. Our conversation opened a path to explore farmer connections, controlled pilot fulfilment, and larger-volume opportunities for crops such as maize, with the precise responsibilities and commercial terms defined for each transaction.",
        },
      ],
    },
    {
      id: "office-conversation-image",
      type: "image",
      url: imageUrl(origin, "extech-office-conversation.webp"),
      alt: "A Kuapa Dwaso representative in conversation with an Extech Agricultural Services team member in Takoradi",
      caption:
        "The office conversation connected operational questions with Extech's experience in Ghanaian agriculture.",
    },
    {
      id: "crops-heading",
      type: "heading2",
      content: [{ text: "Choose crops and routes with evidence" }],
    },
    {
      id: "crops-1",
      type: "paragraph",
      content: [
        {
          text: "Maize came up often during the visit because it moves in larger volumes and connects to established buyers and processors. But a crop should not enter a service schedule simply because it is common or relatively easy to store.",
        },
      ],
    },
    {
      id: "crops-2",
      type: "paragraph",
      content: [
        {
          text: "Kuapa Dwaso evaluates crops and delivery routes through evidence: buyer demand, farmer supply, harvest timing, quality requirements, shelf life, warehouse capacity, transport cost, payment behaviour, and the margin left after fulfilment. The same discipline applies when selecting destination markets and delivery days.",
        },
      ],
    },
    {
      id: "strategy-heading",
      type: "heading2",
      content: [{ text: "Partnerships are the strategy, not a shortcut" }],
    },
    {
      id: "strategy-1",
      type: "paragraph",
      content: [
        {
          text: "Farmers, buyers, transporters, processors, and warehouse operators each hold part of what it takes to move produce successfully. Kuapa Dwaso does not need to own every part of that value chain to make it more dependable.",
        },
      ],
    },
    {
      id: "strategy-2",
      type: "paragraph",
      content: [
        {
          text: "Our role is to coordinate those participants around verified inventory, clear quality expectations, transparent fees and payment terms, published deadlines, and accountable delivery. Partnerships help the network reach farmers, understand production capacity, use local storage responsibly, access credible buyers, and coordinate transport without pretending one organisation already knows or owns everything.",
        },
      ],
    },
    {
      id: "today-heading",
      type: "heading2",
      content: [{ text: "How the lesson shows up today" }],
    },
    {
      id: "today-list",
      type: "numberedList",
      items: [
        [
          {
            text: "Farmers deposit produce at a participating community warehouse.",
          },
        ],
        [
          {
            text: "Warehouse agents record ownership, weight, grade, images, condition, and fees.",
          },
        ],
        [
          {
            text: "Buyers view verified available stock and order before a published cutoff.",
          },
        ],
        [
          {
            text: "Confirmed orders are reserved, aggregated, and prepared for a dated delivery run.",
          },
        ],
        [
          {
            text: "Dispatch records and concise updates keep the movement visible to the people involved.",
          },
        ],
      ],
    },
    {
      id: "measurement-heading",
      type: "heading2",
      content: [{ text: "Measure before scaling" }],
    },
    {
      id: "measurement-1",
      type: "paragraph",
      content: [
        {
          text: "The visit also strengthened our commitment to measure what happens in practice: quantities received and accepted, storage duration, handling and transport costs, order fulfilment, delivery time, payment periods, losses, warehouse utilisation, and farmer and buyer experience.",
        },
      ],
    },
    {
      id: "measurement-2",
      type: "paragraph",
      content: [
        {
          text: "Those numbers will guide decisions more honestly than projections alone. They will show where the current network needs improvement and, over time, whether investment in additional warehouse capacity is commercially justified.",
        },
      ],
    },
    {
      id: "gallery-heading",
      type: "heading2",
      content: [{ text: "Inside the Extech visit" }],
    },
    {
      id: "extech-gallery",
      type: "gallery",
      images: [
        {
          url: imageUrl(origin, "extech-warehouse-team-briefing.webp"),
          alt: "Extech and Kuapa Dwaso team members discussing maize storage beside stacked sacks in a Takoradi warehouse",
          caption: "A practical discussion beside stored maize.",
        },
        {
          url: imageUrl(origin, "extech-office-team.webp"),
          alt: "Kuapa Dwaso representatives seated in the Extech Agricultural Services office",
          caption: "Preparing for the warehouse visit at the Extech office.",
        },
        {
          url: imageUrl(origin, "extech-warehouse-discussion.webp"),
          alt: "Kuapa Dwaso representatives speaking with warehouse workers beside maize handling equipment",
          caption: "Learning how people, equipment, and records work together.",
        },
        {
          url: imageUrl(origin, "extech-warehouse-group.webp"),
          alt: "Extech staff, warehouse workers, and Kuapa Dwaso representatives standing together inside the warehouse",
          caption: "The people behind the warehouse operation.",
        },
        {
          url: imageUrl(origin, "extech-warehouse-team.webp"),
          alt: "Extech staff and Kuapa Dwaso representatives gathered between stored maize and warehouse equipment",
          caption:
            "The visit brought operational questions into a real working environment.",
        },
        {
          url: imageUrl(origin, "extech-warehouse-wide-group.webp"),
          alt: "A wide group photograph of Extech staff, workers, and Kuapa Dwaso representatives in the warehouse",
          caption:
            "Partnership begins with listening to the people doing the work.",
        },
      ],
    },
    {
      id: "closing-heading",
      type: "heading2",
      content: [{ text: "A lesson we continue to carry" }],
    },
    {
      id: "closing-1",
      type: "paragraph",
      content: [
        {
          text: "Earlier conversations with farmers and traders in Tarkwa showed us the problem clearly: farmers need dependable routes to market, buyers need dependable supply, and fragmented transport adds cost and risk for everyone in between.",
        },
      ],
    },
    {
      id: "closing-2",
      type: "paragraph",
      content: [
        {
          text: "Our day with Extech showed us that the answer is not a building in isolation. It is a working network: community warehouses, disciplined records, verified stock, real buyer orders, scheduled delivery, and experienced partners who understand the conditions on the ground.",
        },
      ],
    },
    {
      id: "closing-3",
      type: "paragraph",
      content: [
        {
          text: "We are grateful to Extech Agricultural Services for their openness and the time they gave us. As Kuapa Dwaso grows, we will keep applying the lesson of that visit: listen first, operate carefully, measure what happens, and let evidence lead the next decision.",
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
 * Publishes the Extech field story from docs/blog-drafts/extech-visit2.md.
 *
 * Usage:
 *   npx convex run seedSecondBlog:seed '{"dryRun":true}'
 *   npx convex run seedSecondBlog:seed
 *
 * Idempotent: an existing post with the same slug is updated in place.
 */
export const seed = internalMutation({
  args: {
    actorUserId: v.optional(v.id("users")),
    dryRun: v.optional(v.boolean()),
    siteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const origin = publicSiteOrigin(args.siteUrl);
    const existing = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    const action = existing === null ? "insert" : "update";

    if (args.dryRun === true) {
      return { action: `would-${action}`, slug, siteUrl: origin };
    }

    const actor = await resolveActor(ctx, args.actorUserId);
    const now = Date.now();
    const fields = {
      title: "What We Learned From Our Visit to Extech Agricultural Services",
      slug,
      excerpt:
        "A visit to Extech Agricultural Services helped shape how Kuapa Dwaso now works with community warehouses, verified stock, experienced partners, and scheduled market delivery.",
      category: "partnerships" as const,
      status: "published" as const,
      content: storyContent(origin),
      heroImageUrl: imageUrl(origin, "extech-warehouse-maize.webp"),
      heroImageAlt:
        "Extech staff and Kuapa Dwaso representatives discussing maize storage inside a warehouse in Takoradi",
      heroImageCaption:
        "The Extech warehouse visit connected Kuapa Dwaso's plans with the realities of storing and handling maize.",
      authorName: "Kuapa Dwaso Team",
      location: "Takoradi, Western Region, Ghana",
      occurredAt: Date.UTC(2026, 7, 7),
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
