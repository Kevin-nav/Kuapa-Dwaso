import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getApiEnvironment } from "../config/env.js";
import type { VerifiedAuthToken } from "../lib/auth-principal.js";

export type FirebaseTokenVerifier = {
  verifyIdToken(idToken: string): Promise<VerifiedAuthToken>;
};

export type FirebaseCustomTokenIssuer = {
  createCustomToken(uid: string): Promise<string>;
};

@Injectable()
export class FirebaseAdminTokenVerifier
  implements FirebaseTokenVerifier, FirebaseCustomTokenIssuer
{
  private app: App | undefined;

  async verifyIdToken(idToken: string): Promise<VerifiedAuthToken> {
    const app = this.getOrCreateApp();

    try {
      const decodedToken = await getAuth(app).verifyIdToken(idToken);
      return toVerifiedAuthToken(decodedToken);
    } catch {
      throw new UnauthorizedException("Invalid Firebase bearer token.");
    }
  }

  async createCustomToken(uid: string): Promise<string> {
    try {
      const auth = getAuth(this.getOrCreateApp());
      await auth.getUser(uid);
      return await auth.createCustomToken(uid);
    } catch {
      throw new ServiceUnavailableException(
        "Preview sign-in is not configured.",
      );
    }
  }

  private getOrCreateApp(): App {
    if (this.app !== undefined) {
      return this.app;
    }

    const env = getApiEnvironment();
    if (env.auth.firebaseProjectId === undefined) {
      throw new UnauthorizedException(
        "Firebase token verification is not configured.",
      );
    }

    const appOptions: AppOptions = {
      projectId: env.auth.firebaseProjectId,
    };
    const credential = parseServiceAccountCredential(
      env.auth.firebaseServiceAccountJson,
    );
    if (credential !== undefined) {
      appOptions.credential = credential;
    }

    this.app = getApps().length > 0 ? getApp() : initializeApp(appOptions);

    return this.app;
  }
}

function parseServiceAccountCredential(
  serviceAccountJson: string | undefined,
): ReturnType<typeof cert> | undefined {
  if (serviceAccountJson === undefined || serviceAccountJson.length === 0) {
    return undefined;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    if (typeof serviceAccount.privateKey === "string") {
      serviceAccount.privateKey = serviceAccount.privateKey.replaceAll(
        "\\n",
        "\n",
      );
    }
    return cert(serviceAccount);
  } catch {
    throw new UnauthorizedException(
      "Firebase service account configuration is invalid.",
    );
  }
}

function toVerifiedAuthToken(decodedToken: DecodedIdToken): VerifiedAuthToken {
  const verifiedToken: VerifiedAuthToken = {
    authProvider: "firebase",
    authProviderId: decodedToken.uid,
  };

  if (decodedToken.email !== undefined) {
    verifiedToken.email = decodedToken.email;
  }
  if (decodedToken.email_verified !== undefined) {
    verifiedToken.emailVerified = decodedToken.email_verified;
  }

  if (decodedToken.phone_number !== undefined) {
    verifiedToken.phoneNumber = decodedToken.phone_number;
    verifiedToken.phoneVerified = true;
  }

  const firebaseClaims = decodedToken.firebase as
    | {
        sign_in_provider?: string;
        sign_in_second_factor?: string;
        identities?: Record<string, unknown>;
      }
    | undefined;
  if (firebaseClaims?.sign_in_provider !== undefined) {
    verifiedToken.signInProvider = firebaseClaims.sign_in_provider;
  }
  if (firebaseClaims?.sign_in_second_factor !== undefined) {
    verifiedToken.mfaSatisfied = true;
    verifiedToken.mfaMethods = [firebaseClaims.sign_in_second_factor];
  }

  return verifiedToken;
}
