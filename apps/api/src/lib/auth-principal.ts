import type { MarketplaceRole, UserStatus } from "@kuapa-dwaso/types";

export type AuthPrincipal = {
  authProviderId: string;
  userId?: string;
  roles: MarketplaceRole[];
  status?: UserStatus;
  email?: string;
  phoneNumber?: string;
};

export type VerifiedAuthToken = {
  authProviderId: string;
  authProvider: "firebase";
  email?: string;
  phoneNumber?: string;
};

export type AuthenticatedUserProfile = {
  userId: string;
  authProviderId: string;
  authProvider?: string;
  role: MarketplaceRole;
  status: UserStatus;
  email?: string;
  phoneNumber?: string;
};

export type RequestWithPrincipal = {
  user?: AuthPrincipal;
  headers: {
    authorization?: string | string[];
  };
};
