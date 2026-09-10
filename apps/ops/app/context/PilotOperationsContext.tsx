"use client";

import {
  createContext,
  useContext,
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

const PilotOperationsContext = createContext<PilotOperationsContextValue | undefined>(
  undefined,
);

export function PilotOperationsProvider({ children }: { children: ReactNode }) {
  const { principal } = useOpsAuth();
  const canLoad = principal?.role === "warehouse_agent" && principal.status === "active";
  const result = useQuery(
    api.pilotProgrammes.listAvailable,
    canLoad ? { limit: 20 } : "skip",
  ) as { page: PilotProgrammeOption[] } | undefined;
  const programmes = useMemo(() => result?.page ?? [], [result]);
  const storageKey =
    principal === null || principal === undefined
      ? undefined
      : `kuapa_ops_pilot_programme:${principal.userId}`;
  const [selectedId, setSelectedId] = useState<Id<"pilotProgrammes">>();
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
        if (storageKey !== undefined) window.localStorage.setItem(storageKey, programmeId);
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
    throw new Error("usePilotOperations must be used within PilotOperationsProvider.");
  return context;
}
