import { palette, spacing } from "@kuapa-dwaso/design-tokens";

export type ButtonProps = {
  label: string;
};

export function Button({ label }: ButtonProps) {
  return (
    <button
      style={{
        background: palette.ink,
        border: 0,
        borderRadius: 6,
        color: "white",
        font: "inherit",
        fontWeight: 700,
        padding: spacing.controlPadding
      }}
      type="button"
    >
      {label}
    </button>
  );
}

export * from "./DotField.js";
