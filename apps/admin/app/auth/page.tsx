"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { useAdminAuth } from "./AdminAuthProvider";

export default function AdminAuthPage() {
  const { firebaseUser, principal, signOut } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Admins and warehouse managers sign in with Firebase email/password.");
  const [error, setError] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsWorking(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        setStatus("Email verification is required. A verification email was sent.");
        return;
      }
      setStatus("Signed in. Admin RBAC checks will use this platform principal once admin data wiring is added.");
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "auth/multi-factor-auth-required") {
        setError("Firebase MFA is required. Complete the configured second-factor challenge, then sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not sign in.");
      }
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Admin sign in</h1>
        <p style={{ color: "#6b7280", marginTop: "6px" }}>Minimal Firebase entry path for admin and warehouse-manager identities.</p>
      </div>

      {firebaseUser !== null && (
        <div style={{ background: "#e7f4ec", border: "1px solid #bfe3ca", borderRadius: "8px", padding: "12px" }}>
          Signed in as {firebaseUser.email ?? firebaseUser.uid}. Principal: {principal?.role ?? "not linked yet"}.
        </div>
      )}

      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        style={{ background: "white", border: "1px solid #e2e6ea", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px", padding: "20px" }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <p style={{ color: "#6b7280", margin: 0 }}>{status}</p>
        {error !== undefined && <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="submit" disabled={isWorking} style={{ background: "#2d8a4e", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
            Sign in
          </button>
          {firebaseUser !== null && (
            <button type="button" onClick={() => void signOut()} style={{ background: "white", border: "1px solid #c2c8d0", borderRadius: "6px", color: "#3a4048", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}>
              Sign out
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
