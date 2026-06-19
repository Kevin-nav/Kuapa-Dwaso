import type { MarketplaceAudience } from "@agriculture/types";
import { Button } from "@agriculture/ui";

const audience: MarketplaceAudience = "farmer";

export default function ProductHomePage() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Product app</p>
        <h1>Main marketplace workspace</h1>
        <p>
          This Next.js app is reserved for signed-in product flows. The current runnable foundation
          proves shared types for the {audience} audience without adding product behavior.
        </p>
        <Button label="Product app running" />
      </section>
    </main>
  );
}
