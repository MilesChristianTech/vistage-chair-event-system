export function AppPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-navy-100 bg-white px-8 py-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="mb-0">{title}</h1>
        {description ? <p className="text-navy-500 text-sm mt-1 max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AppPageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-8 py-6">{children}</div>;
}
