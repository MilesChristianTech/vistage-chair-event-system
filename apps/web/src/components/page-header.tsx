export function AppPageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-b border-navy-100 bg-white/90 backdrop-blur px-8 py-5 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {icon}
        <div>
          <h1 className="mb-0">{title}</h1>
          {description ? <p className="text-navy-500 text-sm mt-1 max-w-2xl">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AppPageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-8 py-6">{children}</div>;
}
