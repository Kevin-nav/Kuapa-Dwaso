"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { CurrentPlatformPrincipal } from "@kuapa-dwaso/types";
import { clearPwaData } from "@kuapa-dwaso/utils/pwa";
import { api } from "../../../../convex/_generated/api";
import { firebaseAuth } from "./firebase";

type OpsAuthContextType = {
  firebaseUser: User | null;
  principal: CurrentPlatformPrincipal | null | undefined;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const OpsAuthContext = createContext<OpsAuthContextType | undefined>(undefined);

export function OpsAuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setFirebaseUser(nextUser);
      setIsFirebaseLoading(false);
    });
  }, []);

  const principal = useQuery(
    api.auth.resolveCurrentPrincipal,
    firebaseUser === null
      ? "skip"
      : {
          authProviderId: firebaseUser.uid,
        },
  ) as CurrentPlatformPrincipal | null | undefined;

  const value = useMemo<OpsAuthContextType>(
    () => ({
      firebaseUser,
      principal,
      isLoading: isFirebaseLoading || (firebaseUser !== null && principal === undefined),
      signOut: async () => {
        await clearPwaData().catch(() => undefined);
        await signOut(firebaseAuth);
      },
    }),
    [firebaseUser, isFirebaseLoading, principal],
  );

  return <OpsAuthContext.Provider value={value}>{children}</OpsAuthContext.Provider>;
}

export function useOpsAuth() {
  const context = useContext(OpsAuthContext);
  if (context === undefined) {
    throw new Error("useOpsAuth must be used within OpsAuthProvider.");
  }
  return context;
}
