"use client";

import { useQuery } from "convex/react";
import { SampleDataBanner } from "@kuapa-dwaso/ui/pilot";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../auth/AuthProvider";

export function PilotDemoIndicator() {
  const { principal } = useAuth();
  const programmes = useQuery(
    api.pilotProgrammes.listAvailable,
    principal?.status !== "active" ? "skip" : { limit: 20 },
  ) as
    | {
        page: Array<{
          demoContext: {
            programmeId: string;
            programmeName: string;
            dataMode: "live" | "sample_only";
            datasetId?: string;
          };
        }>;
      }
    | undefined;
  const samples =
    programmes?.page
      .map((programme) => programme.demoContext)
      .filter((context) => context.dataMode === "sample_only") ?? [];
  if (samples.length === 0) return null;
  return (
    <div style={{ paddingTop: 64 }}>
      <SampleDataBanner programmes={samples} />
    </div>
  );
}
