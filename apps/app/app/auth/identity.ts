"use client";

import type { FirebaseIdentityInput } from "@kuapa-dwaso/types";
import type { User } from "firebase/auth";

export function identityFromFirebaseUser(
  user: User,
  overrides: Partial<FirebaseIdentityInput> = {},
): FirebaseIdentityInput {
  const identity: FirebaseIdentityInput = {
    authProviderId: user.uid,
  };

  if (user.phoneNumber !== null) {
    identity.phoneNumber = user.phoneNumber;
    identity.phoneVerified = true;
  }
  if (user.email !== null) {
    identity.email = user.email;
    identity.emailVerified = user.emailVerified;
  }
  if (user.displayName !== null) {
    identity.displayName = user.displayName;
  }

  return { ...identity, ...overrides };
}
