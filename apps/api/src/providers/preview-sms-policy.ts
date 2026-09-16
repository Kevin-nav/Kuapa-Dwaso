import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";

export type PreviewSmsPolicyConfiguration = {
  enabled: boolean;
  recipientAllowlist: readonly string[];
  hourlySegmentLimit: number;
  highCapacityUtcDates: readonly string[];
  highCapacityHourlySegmentLimit: number;
};

type RecipientUsage = {
  windowStartedAt: number;
  segmentsUsed: number;
};

const oneHourMs = 60 * 60 * 1000;

/**
 * A deliberately small, process-local guard for the short preview window.
 * The API provider is a singleton, so reservations cover all sends handled by
 * one API process. The deployment runbook keeps the API at one replica while
 * this temporary access path is enabled.
 */
export class PreviewSmsPolicy {
  private readonly usageByRecipient = new Map<string, RecipientUsage>();

  assertAllowedAndReserve(input: {
    configuration: PreviewSmsPolicyConfiguration;
    recipients: readonly string[];
    segmentsPerRecipient: number;
    messageKind: string;
    now?: number;
  }): void {
    const { configuration } = input;
    if (!configuration.enabled) {
      return;
    }

    if (input.messageKind === "promotional") {
      throw new ForbiddenException(
        "Promotional SMS is disabled while shared preview access is active.",
      );
    }

    const allowlist = new Set(configuration.recipientAllowlist);
    if (allowlist.size === 0) {
      throw new ServiceUnavailableException(
        "Preview SMS recipient allowlist is not configured.",
      );
    }
    const blockedRecipient = input.recipients.find(
      (recipient) => !allowlist.has(recipient),
    );
    if (blockedRecipient !== undefined) {
      throw new ForbiddenException(
        "SMS can only be sent to team-controlled numbers while shared preview access is active.",
      );
    }

    const now = input.now ?? Date.now();
    const windowStartedAt = Math.floor(now / oneHourMs) * oneHourMs;
    const utcDate = new Date(now).toISOString().slice(0, 10);
    const limit = configuration.highCapacityUtcDates.includes(utcDate)
      ? configuration.highCapacityHourlySegmentLimit
      : configuration.hourlySegmentLimit;

    const proposedUsage = input.recipients.map((recipient) => {
      const current = this.usageByRecipient.get(recipient);
      const segmentsUsed =
        current?.windowStartedAt === windowStartedAt ? current.segmentsUsed : 0;
      return {
        recipient,
        segmentsUsed: segmentsUsed + input.segmentsPerRecipient,
      };
    });
    if (proposedUsage.some((usage) => usage.segmentsUsed > limit)) {
      throw new HttpException(
        "The hourly SMS limit for this preview phone number has been reached.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    for (const usage of proposedUsage) {
      this.usageByRecipient.set(usage.recipient, {
        windowStartedAt,
        segmentsUsed: usage.segmentsUsed,
      });
    }
  }
}
