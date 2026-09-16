import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  getApiEnvironment,
  previewAccessRoles,
  type PreviewAccessRole,
} from "../config/env.js";
import { FirebaseAdminTokenVerifier } from "../providers/firebase-auth.provider.js";
import { InMemoryRateLimitProvider } from "../providers/rate-limit.provider.js";
import { ConvexUserProfilesProvider } from "../providers/convex-user-profiles.provider.js";

type CreatePreviewSessionInput = {
  clientIp: string;
  role: unknown;
};

@Injectable()
export class CreatePreviewSessionWorkflow {
  constructor(
    private readonly firebase: FirebaseAdminTokenVerifier,
    private readonly rateLimits: InMemoryRateLimitProvider,
    private readonly userProfiles: ConvexUserProfilesProvider,
  ) {}

  async run(
    input: CreatePreviewSessionInput,
  ): Promise<{ customToken: string; role: PreviewAccessRole }> {
    const environment = getApiEnvironment();
    const cutoff = parseActiveCutoff(
      environment.previewAccess.enabled,
      environment.previewAccess.cutoffUtc,
    );

    if (Date.now() >= cutoff) {
      throw previewUnavailable();
    }

    const rateLimit = this.rateLimits.check({
      key: `preview-session:${normalizeClientIp(input.clientIp)}`,
      limit: environment.rateLimit.previewSessionMax,
      windowMs: environment.rateLimit.windowMs,
    });
    if (!rateLimit.allowed) {
      throw new HttpException(
        "Too many preview sign-in attempts. Try again after the rate-limit window resets.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const role = parsePreviewAccessRole(input.role);
    const firebaseUid = environment.previewAccess.firebaseUids[role]?.trim();
    if (firebaseUid === undefined || firebaseUid.length === 0) {
      throw new ServiceUnavailableException(
        "Preview sign-in is not configured for this role.",
      );
    }

    const profile = await this.userProfiles.getByAuthProviderId(firebaseUid);
    if (
      profile === null ||
      profile.role !== role ||
      profile.status !== "active"
    ) {
      throw new ServiceUnavailableException(
        "Preview sign-in is not configured for this role.",
      );
    }

    return {
      customToken: await this.firebase.createCustomToken(firebaseUid),
      role,
    };
  }
}

function parsePreviewAccessRole(value: unknown): PreviewAccessRole {
  if (
    typeof value === "string" &&
    previewAccessRoles.some((role) => role === value)
  ) {
    return value as PreviewAccessRole;
  }
  throw new BadRequestException(
    "role must be farmer, buyer, transporter, or warehouse_agent.",
  );
}

function parseActiveCutoff(
  enabled: boolean,
  cutoffUtc: string | undefined,
): number {
  if (!enabled || cutoffUtc === undefined) {
    throw previewUnavailable();
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(cutoffUtc)) {
    throw previewUnavailable();
  }
  const parsed = Date.parse(cutoffUtc);
  if (!Number.isFinite(parsed)) {
    throw previewUnavailable();
  }
  return parsed;
}

function previewUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException("Preview sign-in is not available.");
}

function normalizeClientIp(clientIp: string): string {
  const normalized = clientIp.trim();
  return normalized.length > 0 ? normalized.slice(0, 128) : "unknown";
}
