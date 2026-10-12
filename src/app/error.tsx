"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-5xl italic">Something went wrong</p>
        <button type="button" className="mt-6 rounded-full bg-copper px-4 py-2 text-sm text-white" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
