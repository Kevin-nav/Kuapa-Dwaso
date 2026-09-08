export const palette = {
  /** Vibrant vegetation green - primary brand color */
  field: "#2d8a4e",
  /** Lighter field green for hover states */
  fieldLight: "#38a85c",
  /** Deep green pressed state for field buttons */
  fieldDark: "#1f6b3a",
  /** Deep green-black for text and dark surfaces */
  ink: "#0f1f14",
  /** Slightly lifted ink for section backgrounds */
  inkSoft: "#1a2e20",
  /** Vivid teal-cyan accent */
  sky: "#0d9488",
  /** Warm off-white for backgrounds */
  surface: "#f5f7f0",
  /** Explicit card-on-surface token */
  surfaceRaised: "#ffffff",
  /** Hairline border color on warm surfaces */
  line: "#dde3d5",
  /** Lush emerald for highlights and gradients */
  emerald: "#10b981",
  /** Clay accent pulled from market umbrella photography */
  clay: "#c2410c",
  /** Golden accent for badges and sparse highlights */
  gold: "#eab308",
  /** Golden accent for premium touches (deprecating) */
  accent: "#d4a843",
  /** Golden accent for premium touches */
  goldMuted: "#d4a843",
  /** Dark gold/brown ink for high contrast text on gold badges */
  goldInk: "#854d0e",
} as const;

export const status = {
  // Success / positive / verified / paid / fresh
  success: "#15803d",
  successBg: "#e7f4ec",
  successBorder: "#bfe3ca",

  // Warning / pending / expiring soon / under review
  warning: "#b45309",     // darker than gold for AA on light bg
  warningBg: "#fdf3e3",
  warningBorder: "#f2dcae",

  // Danger / suspended / rejected / spoilage / overdue
  danger: "#b91c1c",
  dangerBg: "#fbeaea",
  dangerBorder: "#f0c4c4",

  // Info / neutral-active / reserved / in-transit
  info: "#0e7490",        // aligns with your sky teal family
  infoBg: "#e3f2f4",
  infoBorder: "#b7dde1",

  // Neutral / inactive / draft / cancelled
  neutral: "#64748b",
  neutralBg: "#f1f3f5",
  neutralBorder: "#dde1e6",

  // Offline/sync state — agents need this constantly
  offline: "#7c3aed",
  offlineBg: "#f1ebfb",
  offlineBorder: "#d9c9f2",
} as const;

export const interaction = {
  focusRing: "#0d9488",
  focusRingOffset: "#f5f7f0",
} as const;

export const gray = {
  0:  "#ffffff",   // cards, table surface
  25: "#f6f7f9",   // app background (your existing)
  50: "#eef0f3",   // table header, zebra
  100:"#e2e6ea",   // hairlines / dividers
  300:"#c2c8d0",   // disabled borders
  400:"#8b95a1",   // subdued disabled text
  500:"#6b7280",   // secondary/muted text
  600:"#4b5563",   // stronger secondary text
  700:"#3a4048",   // body text
  800:"#2b3037",   // emphasized body text
  900:"#20242a",   // headings (your existing)
} as const;

export const spacing = {
  controlPadding: "0.75rem 1rem",
} as const;

export const pilotLedger = {
  paper: "#fffdf5",
  paperMuted: "#f4f0df",
  rule: "#d8d0b5",
  maize: "#d9a514",
  maizeSoft: "#fff3bf",
  stamp: "#7a4c08",
  inkMuted: "#586257",
} as const;
