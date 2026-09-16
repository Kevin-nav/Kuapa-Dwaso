"use client";

import { useEffect, useState } from "react";
import type { SelfServiceWorkspace } from "@kuapa-dwaso/types";
import {
  readWorkspacePreference,
  resolveSelfServiceWorkspace,
} from "@kuapa-dwaso/utils/pwa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sprout, Truck, Warehouse } from "lucide-react";
import { useAuth } from "./auth/AuthProvider";

const previewAccessEnabled =
  process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";

export default function ProductHomePage() {
  const { firebaseUser, principal, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [workspacePreference, setWorkspacePreference] = useState<{
    ownerUserId?: string;
    workspace?: SelfServiceWorkspace;
  }>({});

  const savedWorkspace =
    principal !== null &&
    principal !== undefined &&
    workspacePreference.ownerUserId === principal.userId
      ? workspacePreference.workspace
      : undefined;
  const workspaceLoaded =
    principal === null ||
    (principal !== undefined &&
      workspacePreference.ownerUserId === principal.userId);
  const workspacePath = resolveWorkspacePath(principal, savedWorkspace);

  useEffect(() => {
    if (principal === null || principal === undefined) return;
    let mounted = true;
    void readWorkspacePreference(principal.userId)
      .then((workspace) => {
        if (mounted)
          setWorkspacePreference({
            ownerUserId: principal.userId,
            ...(workspace === undefined ? {} : { workspace }),
          });
      })
      .catch(() => {
        if (mounted) setWorkspacePreference({ ownerUserId: principal.userId });
      });
    return () => {
      mounted = false;
    };
  }, [principal]);

  useEffect(() => {
    if (
      !isLoading &&
      workspaceLoaded &&
      firebaseUser !== null &&
      workspacePath !== undefined
    ) {
      if (workspacePath.startsWith("http"))
        window.location.assign(workspacePath);
      else router.replace(workspacePath);
    }
  }, [isLoading, workspaceLoaded, firebaseUser, workspacePath, router]);

  if (isLoading || (firebaseUser !== null && !workspaceLoaded)) {
    return (
      <main className="page-shell">
        <section className="intro">
          <div
            className="skeleton"
            style={{ width: "120px", height: "20px", marginBottom: "16px" }}
          />
          <div
            className="skeleton"
            style={{ width: "280px", height: "40px", marginBottom: "20px" }}
          />
          <div
            className="skeleton"
            style={{ width: "100%", height: "60px", marginBottom: "24px" }}
          />
          <div className="button-row" style={{ width: "100%" }}>
            <div
              className="skeleton"
              style={{ flex: 1, height: "56px", borderRadius: "12px" }}
            />
            <div
              className="skeleton"
              style={{ flex: 1, height: "56px", borderRadius: "12px" }}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">
          {previewAccessEnabled
            ? "Choose a workspace"
            : "Your marketplace workspace"}
        </p>
        <h1 style={{ fontSize: "2.25rem", color: "var(--color-ink)" }}>
          Kuapa Dwaso marketplace
        </h1>
        <p style={{ maxWidth: "480px", margin: "0 auto 32px" }}>
          {previewAccessEnabled
            ? "Explore the maize journey from the perspective that interests you."
            : "Create the account that matches your work, or return directly to your own workspace."}
        </p>

        {firebaseUser !== null ? (
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {workspacePath !== undefined ? (
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={() =>
                  workspacePath.startsWith("http")
                    ? window.location.assign(workspacePath)
                    : router.push(workspacePath)
                }
              >
                Continue to your workspace
              </button>
            ) : (
              <div
                className="attention-card"
                style={{ textAlign: "left", marginBottom: "8px" }}
              >
                <div className="attention-body">
                  <span className="attention-title">Profile Required</span>
                  <span className="attention-text">
                    You are signed in, but your platform profile is not ready.
                    Accept your invitation or contact support; you do not need
                    to choose a role again.
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => void signOut()}
            >
              Sign Out
            </button>
          </div>
        ) : previewAccessEnabled ? (
          <div className="preview-role-grid">
            <Link href="/farmer/login" className="preview-role-card">
              <span className="preview-role-icon">
                <Sprout size={22} />
              </span>
              <span>
                <strong>Farmer</strong>
                <small>Add maize and review an offer</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/buyer/login" className="preview-role-card">
              <span className="preview-role-icon">
                <Search size={22} />
              </span>
              <span>
                <strong>Buyer</strong>
                <small>Request maize and follow delivery</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/transporter/login" className="preview-role-card">
              <span className="preview-role-icon">
                <Truck size={22} />
              </span>
              <span>
                <strong>Transporter</strong>
                <small>View a route and confirm collection</small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href={`${externalWorkspace("ops")}auth`}
              className="preview-role-card"
            >
              <span className="preview-role-icon">
                <Warehouse size={22} />
              </span>
              <span>
                <strong>Operations</strong>
                <small>
                  Match supply, inspect maize, and arrange collection
                </small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div
            className="button-row"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <Link href="/signup" style={{ width: "100%" }}>
              <button type="button" className="btn btn-primary btn-full">
                Create a farmer or buyer account
              </button>
            </Link>
            <div className="auth-route-grid">
              <Link href="/farmer/login">Farmer login</Link>
              <Link href="/buyer/login">Buyer login</Link>
              <Link href="/transporter/login">Transporter login</Link>
            </div>
            <Link href="/invites/accept" style={{ width: "100%" }}>
              <button type="button" className="btn btn-secondary btn-full">
                Accept Platform Invite
              </button>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function resolveWorkspacePath(
  principal: ReturnType<typeof useAuth>["principal"],
  savedWorkspace?: SelfServiceWorkspace,
): string | undefined {
  if (principal == null) return undefined;
  const profileTypes = new Set(
    principal.profiles.map((profile) => profile.profileType),
  );
  if (principal.role === "admin" || profileTypes.has("admin"))
    return externalWorkspace("admin");
  if (
    principal.role === "warehouse_agent" ||
    profileTypes.has("warehouse_agent")
  )
    return externalWorkspace("ops");
  const workspace = resolveSelfServiceWorkspace(principal, savedWorkspace);
  if (workspace !== undefined) return `/${workspace}`;
  return undefined;
}

function externalWorkspace(kind: "admin" | "ops") {
  if (typeof window === "undefined") return `https://${kind}.kuapadwaso.com/`;
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  )
    return `http://localhost:${kind === "admin" ? "3002" : "3003"}/`;
  return `https://${kind}.${window.location.hostname.includes("staging") ? "staging." : ""}kuapadwaso.com/`;
}
