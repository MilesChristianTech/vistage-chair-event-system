import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function AppPageHeader({
  title,
  description,
  actions,
  icon,
  backHref,
  backLabel,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="border-b border-navy-100 bg-white/90 backdrop-blur px-8 py-5">
      {backHref ? (
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-navy-400 hover:text-navy-700 text-sm mb-2.5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {backLabel ?? 'Back'}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {icon}
          <div>
            <h1 className="mb-0">{title}</h1>
            {description ? <p className="text-navy-500 text-sm mt-1 max-w-2xl">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

export function AppPageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-8 py-6">{children}</div>;
}
