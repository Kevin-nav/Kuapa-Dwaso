import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

export type InviteTokenPair = {
  rawToken: string;
  tokenHash: string;
};

@Injectable()
export class InviteTokenProvider {
  createToken(): InviteTokenPair {
    const rawToken = randomBytes(32).toString("base64url");
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken)
    };
  }

  hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }
}
