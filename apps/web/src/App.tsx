import { designDocumentFixtures } from "@headstone/schema";

export function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Headstone Design Studio</p>
        <h1>Shared schema foundation</h1>
        <p>
          The workspace is scaffolded and the shared design document schema is
          live.
        </p>
      </section>

      <section className="card">
        <h2>Schema fixtures</h2>
        <p>{designDocumentFixtures.length} memorial design cases are seeded.</p>
      </section>
    </main>
  );
}
