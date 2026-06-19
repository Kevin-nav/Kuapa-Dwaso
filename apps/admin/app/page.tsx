import { DashboardStatusPanel } from "@agriculture/dashboard-ui";
import type { MarketplaceAudience } from "@agriculture/types";

const audience: MarketplaceAudience = "admin";

export default function AdminHomePage() {
  return (
    <main className="page-shell">
      <DashboardStatusPanel
        eyebrow="Admin console"
        heading="Operations workspace"
        status={`Separate Next.js admin app for the ${audience} audience. Dashboard UI is intentionally isolated here.`}
      />
    </main>
  );
}
