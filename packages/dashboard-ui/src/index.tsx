import { palette } from "@kuapa-dwaso/design-tokens";
import { Button } from "@kuapa-dwaso/ui";

export type DashboardStatusPanelProps = {
  eyebrow: string;
  heading: string;
  status: string;
};

export function DashboardStatusPanel({ eyebrow, heading, status }: DashboardStatusPanelProps) {
  return (
    <section
      style={{
        borderLeft: `6px solid ${palette.sky}`,
        maxWidth: 720,
        padding: "24px 0 24px 28px"
      }}
    >
      <p
        style={{
          color: palette.sky,
          fontSize: "0.875rem",
          fontWeight: 700,
          margin: "0 0 12px",
          textTransform: "uppercase"
        }}
      >
        {eyebrow}
      </p>
      <h1
        style={{
          fontSize: "clamp(2rem, 6vw, 4rem)",
          lineHeight: 1,
          margin: "0 0 20px"
        }}
      >
        {heading}
      </h1>
      <p
        style={{
          fontSize: "1.125rem",
          lineHeight: 1.6,
          margin: "0 0 24px"
        }}
      >
        {status}
      </p>
      <Button label="Admin app running" />
    </section>
  );
}
