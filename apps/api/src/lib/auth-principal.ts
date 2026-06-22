import type { MarketplaceRole } from "@kuapa-dwaso/types";

export type AuthPrincipal = {
  authProviderId: string;
  userId?: string;
  roles: MarketplaceRole[];
  email?: string;
  phoneNumber?: string;
};

export type RequestWithPrincipal = {
  user?: AuthPrincipal;
  headers: {
    authorization?: string | string[];
  };
};
