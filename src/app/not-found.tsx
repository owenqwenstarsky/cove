import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-5xl italic">Missing</p>
        <p className="mt-3 text-muted">That page or file is not available.</p>
        <Link href="/drive" className="mt-6 inline-block text-tide underline">
          Back to My Drive
        </Link>
      </div>
    </main>
  );
}
