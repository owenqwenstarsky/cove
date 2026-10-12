export function AppLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <p className="font-display text-4xl italic text-tide">Cove</p>
    </div>
  );
}

export function DatabaseUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-sidebar px-6 text-sidebar-foreground">
      <div className="max-w-md">
        <p className="font-display text-5xl italic">Cove</p>
        <h1 className="mt-6 text-2xl">Postgres is not reachable.</h1>
        <p className="mt-3 text-sidebar-foreground/75">
          Start the database with <code className="text-white">docker compose up -d db</code>, then refresh this page.
        </p>
      </div>
    </main>
  );
}

export function AuthCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-sidebar text-sidebar-foreground lg:grid-cols-2">
      <section className="flex min-w-0 flex-col justify-between px-8 py-10 sm:px-14">
        <p className="font-display text-4xl italic">Cove</p>
        <div className="max-w-lg py-16">
          <p className="text-sm uppercase tracking-[0.22em] text-copper">{eyebrow}</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] text-balance sm:text-6xl">{title}</h1>
        </div>
        <p className="text-sm text-sidebar-foreground/60">Files, documents, spreadsheets, and slides on your own server.</p>
      </section>
      <section className="flex min-w-0 items-center bg-background px-6 py-12 text-foreground sm:px-12">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
