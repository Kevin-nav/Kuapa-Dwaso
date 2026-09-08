import type { MarketplaceRole, MfaRequirement, MfaStatus, OnboardingState, UserStatus } from "@kuapa-dwaso/types";

export type AuthPrincipal = {
  authProviderId: string;
  firebaseIdToken?: string;
  userId?: string;
  roles: MarketplaceRole[];
  status?: UserStatus;
  email?: string;
  phoneNumber?: string;
  mfaRequirement?: MfaRequirement;
  mfaStatus?: MfaStatus;
  onboardingState?: OnboardingState;
};

export type VerifiedAuthToken = {
  authProviderId: string;
  authProvider: "firebase";
  email?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  signInProvider?: string;
  mfaSatisfied?: boolean;
  mfaMethods?: string[];
};

export type AuthenticatedUserProfile = {
  userId: string;
  authProviderId: string;
  authProvider?: string;
  role: MarketplaceRole;
  status: UserStatus;
  email?: string;
  phoneNumber?: string;
  mfaRequirement?: MfaRequirement;
  mfaStatus?: MfaStatus;
  onboardingState?: OnboardingState;
};

export type RequestWithPrincipal = {
  user?: AuthPrincipal;
  headers: {
    authorization?: string | string[];
  };
};
