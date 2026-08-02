import Link from 'next/link';
import BrandMark from '@/components/brand-mark';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="bg-paper min-h-screen">
      <header className="border-b border-navy-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-navy-900 font-serif text-base">Chair Event System</span>
          </Link>
          <Link href="/sign-in" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="rounded-md border border-warn/25 bg-warn-bg text-warn text-sm px-4 py-3 mb-8">
          This is a placeholder, not a finished legal document, and should be reviewed by a qualified attorney before
          being relied on for real paying customers.
        </div>
        <h1>{title}</h1>
        <div className="prose-legal mt-6 space-y-6 text-navy-700 leading-relaxed">{children}</div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
