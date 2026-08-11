"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { classifyOfflineError, listOfflineActions, removeOfflineAction, updateOfflineAction } from "@kuapa-dwaso/utils/pwa";
import { useAuth } from "../auth/AuthProvider";

export function AppOutboxReplayer() {
  const { principal } = useAuth();
  const createDispute = useMutation(api.disputes.create);
  const updateDispatch = useMutation(api.dispatches.updateStatus);
  const running = useRef(false);

  const drain = useCallback(async () => {
    if (running.current || !navigator.onLine || principal === null || principal === undefined) return;
    running.current = true;
    try {
      const items = await listOfflineActions(principal.userId);
      for (const item of items) {
        if (item.surface !== "app" || item.state === "needs_attention") continue;
        const syncing = { ...item, state: "syncing" as const };
        await updateOfflineAction(syncing);
        try {
          if (item.kind === "farmer_dispute_create") {
            await createDispute(item.payload as Parameters<typeof createDispute>[0]);
          } else if (item.kind === "transporter_dispatch_status") {
            await updateDispatch(item.payload as Parameters<typeof updateDispatch>[0]);
          } else continue;
          await removeOfflineAction(item.clientActionId);
        } catch (error) {
          const retry = classifyOfflineError(error) === "retry" && item.attemptCount < 2;
          await updateOfflineAction({ ...item, attemptCount: item.attemptCount + 1, state: retry ? "pending" : "needs_attention", lastError: error instanceof Error ? error.message : "Sync failed." });
          if (retry) break;
        }
      }
    } finally {
      running.current = false;
    }
  }, [createDispute, principal, updateDispatch]);

  useEffect(() => {
    const resume = () => { if (document.visibilityState === "visible") void drain(); };
    void drain();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, [drain]);
  return null;
}
