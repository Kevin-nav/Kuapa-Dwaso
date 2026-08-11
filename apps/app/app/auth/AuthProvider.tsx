"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { CurrentPlatformPrincipal } from "@kuapa-dwaso/types";
import { clearPwaData, disableWebPush } from "@kuapa-dwaso/utils/pwa";
import { api } from "../../../../convex/_generated/api";
import { firebaseAuth } from "./firebase";

type AuthContextType = {
  firebaseUser: User | null;
  principal: CurrentPlatformPrincipal | null | undefined;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo<AuthContextType>(
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
