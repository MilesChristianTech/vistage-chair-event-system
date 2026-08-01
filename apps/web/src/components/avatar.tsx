// Deterministic, on-brand initials avatar — no images to manage, no
// external service, and every person gets a stable color across visits.
const PALETTE = [
  'from-navy-600 to-navy-800',
  'from-gold-400 to-gold-600',
  'from-navy-500 to-navy-700',
  'from-gold-300 to-gold-500',
  'from-navy-700 to-navy-950',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash;
}

export default function Avatar({
  firstName,
  lastName,
  size = 'md',
}: {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md';
}) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const gradient = PALETTE[hashName(`${firstName}${lastName}`) % PALETTE.length];
  const sizeClasses = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';

  return (
    <span
      className={`inline-flex ${sizeClasses} shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-semibold text-white ring-1 ring-white/10`}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
