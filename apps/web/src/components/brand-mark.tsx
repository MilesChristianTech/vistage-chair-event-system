// The one lettermark used everywhere (sidebar, sign-in). Deliberately
// simple: a single solid surface and clean serif type — no stacked
// gradients/glows, which read as muddy at small sizes and undercut the
// "restrained, premium" brief rather than serving it.
export default function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-14 w-14 text-2xl rounded-2xl' : 'h-8 w-8 text-sm rounded-lg';

  return (
    <span
      className={`inline-flex ${dimensions} shrink-0 items-center justify-center bg-navy-900 font-serif text-gold-300 ring-1 ring-white/10`}
      aria-hidden
    >
      C
    </span>
  );
}
