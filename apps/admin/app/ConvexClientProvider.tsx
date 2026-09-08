"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { firebaseAuth } from "./auth/firebase";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required to start the KuapaDwaso admin.");
}

const convex = new ConvexReactClient(convexUrl);

type ConvexClientProviderProps = {
  children: ReactNode;
};

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  return <ConvexProviderWithAuth client={convex} useAuth={useFirebaseAuth}>{children}</ConvexProviderWithAuth>;
}

function useFirebaseAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onIdTokenChanged(firebaseAuth, setUser), []);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => (await user?.getIdToken(forceRefreshToken)) ?? null,
    [user],
  );
  return { isLoading: user === undefined, isAuthenticated: user !== undefined && user !== null, fetchAccessToken };
}
