"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import { useOpsAuth } from "../auth/OpsAuthProvider";

export type PilotProgrammeOption = {
  id: Id<"pilotProgrammes">;
  code: string;
  name: string;
  region: string;
  district?: string;
  status: "draft" | "active" | "suspended" | "closed";
  datasetProvenance: "live" | "sample_only";
  commercialConfigurationStatus: "missing" | "draft" | "approved";
};

type PilotOperationsContextValue = {
  programmes: PilotProgrammeOption[];
  activeProgramme: PilotProgrammeOption | undefined;
  activeProgrammeId: Id<"pilotProgrammes"> | undefined;
  setActiveProgrammeId: (programmeId: Id<"pilotProgrammes">) => void;
  isLoading: boolean;
};

const PilotOperationsContext = createContext<
  PilotOperationsContextValue | undefined
>(undefined);

export function PilotOperationsProvider({ children }: { children: ReactNode }) {
  const { principal } = useOpsAuth();
  const canLoad =
    principal?.role === "warehouse_agent" && principal.status === "active";
  const result = useQuery(
    api.pilotProgrammes.listAvailable,
    canLoad ? { limit: 20 } : "skip",
  ) as { page: PilotProgrammeOption[] } | undefined;
  const demoPresentation = process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true";
  const previewAccessEnabled =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const previewProgrammeId = process.env.NEXT_PUBLIC_PREVIEW_PROGRAMME_ID;
  const programmes = useMemo(
    () =>
      (result?.page ?? []).filter((programme) =>
        previewAccessEnabled
          ? programme.id === previewProgrammeId
          : demoPresentation
            ? programme.datasetProvenance === "sample_only"
            : programme.datasetProvenance === "live",
      ),
    [demoPresentation, previewAccessEnabled, previewProgrammeId, result],
  );
  const storageKey =
    principal === null || principal === undefined
      ? undefined
      : `kuapa_ops_pilot_programme:${principal.userId}`;
  const [selectedId, setSelectedId] = useState<Id<"pilotProgrammes">>();
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (storageKey === undefined) {
        setSelectedId(undefined);
        return;
      }
      const saved = window.localStorage.getItem(storageKey);
      setSelectedId(
        saved !== null && programmes.some((programme) => programme.id === saved)
          ? (saved as Id<"pilotProgrammes">)
          : undefined,
      );
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [programmes, storageKey]);
  const activeProgramme =
    programmes.find((item) => item.id === selectedId) ?? programmes[0];
  const value = useMemo<PilotOperationsContextValue>(
    () => ({
      programmes,
      activeProgramme,
      activeProgrammeId: activeProgramme?.id,
      setActiveProgrammeId: (programmeId) => {
        if (!programmes.some((item) => item.id === programmeId)) return;
        setSelectedId(programmeId);
        if (storageKey !== undefined)
          window.localStorage.setItem(storageKey, programmeId);
      },
      isLoading: canLoad && result === undefined,
    }),
    [activeProgramme, canLoad, programmes, result, storageKey],
  );

  return (
    <PilotOperationsContext.Provider value={value}>
      {children}
    </PilotOperationsContext.Provider>
  );
}

export function usePilotOperations(): PilotOperationsContextValue {
  const context = useContext(PilotOperationsContext);
  if (context === undefined)
    throw new Error(
      "usePilotOperations must be used within PilotOperationsProvider.",
    );
  return context;
}
