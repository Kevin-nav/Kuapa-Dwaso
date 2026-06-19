import { Button } from "@agriculture/ui";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Public site</p>
        <h1>Agriculture Marketplace</h1>
        <p>
          A lightweight public entry point for growers, buyers, and market partners. This app runs
          independently from the product dashboard and admin console.
        </p>
        <Button label="Marketplace foundation ready" />
      </section>
    </main>
  );
}
