"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import type { CurrentPlatformPrincipal } from "@kuapa-dwaso/types";
import { clearPwaData, disableWebPush } from "@kuapa-dwaso/utils/pwa";
import { api } from "../../../../convex/_generated/api";
import { firebaseAuth } from "./firebase";

type AdminAuthContextType = {
  firebaseUser: User | null;
  principal: CurrentPlatformPrincipal | null | undefined;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo<AdminAuthContextType>(
    () => ({
      firebaseUser,
      principal,
      isLoading: isFirebaseLoading || (firebaseUser !== null && principal === undefined),
      signOut: async () => {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
        if (firebaseUser !== null && apiBaseUrl !== undefined) await disableWebPush({ apiBaseUrl, getToken: () => firebaseUser.getIdToken() }).catch(() => undefined);
        await clearPwaData().catch(() => undefined);
        await signOut(firebaseAuth);
      },
    }),
    [firebaseUser, isFirebaseLoading, principal],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider.");
  }
  return context;
}
