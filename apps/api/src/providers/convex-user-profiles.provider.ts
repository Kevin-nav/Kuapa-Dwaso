import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getApiEnvironment } from "../config/env.js";
import type { AuthenticatedUserProfile } from "../lib/auth-principal.js";

export type UserProfilesProvider = {
  getByAuthProviderId(authProviderId: string): Promise<AuthenticatedUserProfile | null>;
};

const getUserProfileByAuthProviderId = makeFunctionReference<
  "query",
  { authProviderId: string },
  AuthenticatedUserProfile | null
>("users:getByAuthProviderId");

@Injectable()
export class ConvexUserProfilesProvider implements UserProfilesProvider {
  private client: ConvexHttpClient | undefined;

  async getByAuthProviderId(authProviderId: string): Promise<AuthenticatedUserProfile | null> {
    const client = this.getClient();
    return await client.query(getUserProfileByAuthProviderId, { authProviderId });
  }

  private getClient(): ConvexHttpClient {
    if (this.client !== undefined) {
      return this.client;
    }

    const env = getApiEnvironment();
    if (env.auth.convexUrl === undefined) {
      throw new ServiceUnavailableException("Convex URL is not configured for authenticated profile lookup.");
    }

    this.client = new ConvexHttpClient(env.auth.convexUrl);
    return this.client;
  }
}
