import BrandMark from '@/components/brand-mark';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <BrandMark />
        <span className="font-serif text-lg text-navy-950">Chair Event System</span>
      </div>
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}
