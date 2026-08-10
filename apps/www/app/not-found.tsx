import { officialContactEmail, officialContactHref } from "@kuapa-dwaso/config";
import { Logo } from "./site-header";
export default function NotFound() {
  return (
    <main className="not-found">
      <Logo className="h-12 w-12" />
      <p className="eyebrow">404 — page not found</p>
      <h1>This path has not been harvested.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <div>
        <a className="btn-primary" href="/">
          Return home
        </a>
        <a href={officialContactHref}>Contact {officialContactEmail}</a>
      </div>
    </main>
  );
}
