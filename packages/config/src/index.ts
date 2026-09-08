export const officialContactEmail = "info@kuapadwaso.com";
export const officialContactHref = `mailto:${officialContactEmail}`;
export const publicSiteUrl = "https://kuapadwaso.com";

export const pilotVocabulary = {
  facility: "Collection location",
  operationsTeam: "Operations",
  warehouseFacility: "Warehouse",
  warehouseTeam: "Warehouse operations",
} as const;

export type PilotDemoContext = {
  programmeId: string;
  programmeName: string;
  dataMode: "live" | "sample_only";
  datasetId?: string;
};
