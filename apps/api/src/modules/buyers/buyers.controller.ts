import { Body, Controller, Post, UseGuards, UnauthorizedException } from "@nestjs/common";
import { FirebaseAuthGuard } from "../../guards/firebase-auth.guard.js";
import { CurrentPrincipal } from "../../lib/current-principal.js";
import type { AuthPrincipal } from "../../lib/auth-principal.js";
import { BuyerEmailTemplatesProvider } from "../../providers/buyer-email-templates.provider.js";
import { ConvexPlatformProvider } from "../../providers/convex-platform.provider.js";
import { ResendEmailProvider } from "../../providers/email.provider.js";

@Controller("buyers")
export class BuyersController {
  constructor(
    private readonly convex: ConvexPlatformProvider,
    private readonly email: ResendEmailProvider,
    private readonly templates: BuyerEmailTemplatesProvider,
  ) {}

  @Post("institution-welcome")
  @UseGuards(FirebaseAuthGuard)
  async sendInstitutionWelcome(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: { buyerId?: string },
  ): Promise<{ sent: boolean; provider?: string; alreadySent?: boolean }> {
    if (principal.userId === undefined) throw new UnauthorizedException("Convex user profile is required.");
    if (!body.buyerId) throw new UnauthorizedException("Buyer profile is required.");
    const buyer = await this.convex.getInstitutionWelcomeEmailContext({ actorUserId: principal.userId, buyerId: body.buyerId });
    if (buyer === null) throw new UnauthorizedException("Institution buyer profile was not found.");
    if (buyer.institutionWelcomeEmailSentAt !== undefined) return { sent: true, alreadySent: true };
    const template = this.templates.institutionWelcome({
      contactName: buyer.fullName,
      organizationName: buyer.organizationName ?? "your organization",
      ...(buyer.destinationMarket === undefined ? {} : { destinationMarket: buyer.destinationMarket }),
    });
    const delivery = await this.email.sendEmail({ to: buyer.email, ...template });
    await this.convex.recordInstitutionWelcomeEmail({
      actorUserId: principal.userId,
      buyerId: body.buyerId,
      provider: delivery.provider,
      ...(delivery.messageId === undefined ? {} : { messageId: delivery.messageId }),
    });
    return { sent: true, provider: delivery.provider };
  }
}
