import Link from 'next/link';
import { Users, Sparkles, ClipboardList, Send, LineChart, Check, type LucideIcon } from 'lucide-react';
import BrandMark from '@/components/brand-mark';
import { signOutAction } from '@/app/sign-in/actions';

// The public marketing front door. Distinct from the sign-in screen (Part
// 2.5 of the original build spec deliberately kept that minimal) - this is
// the page a prospective Host lands on before they have an account at all.
//
// Positioning note: this describes itself as built BY a Vistage Chair FOR
// Vistage Chairs - a peer recommendation - not as an official Vistage
// product. No Vistage trademark/logo is used here pending confirmation
// there's authorization to use it (see chat).
export default function MarketingLanding({ isSignedIn = false }: { isSignedIn?: boolean }) {
  return (
    <main className="bg-paper">
      {/* ---------- Hero ---------- */}
      <div className="relative overflow-hidden bg-navy-975">
        <div className="absolute inset-0 bg-aurora-navy animate-aurora" aria-hidden />
        <div className="absolute inset-0 bg-grid-lines bg-[length:42px_42px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_20%,black_10%,transparent_75%)]" aria-hidden />

        <header className="relative max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-white font-serif text-base">Chair Event System</span>
          </Link>
          {isSignedIn ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20">
                Go to dashboard
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="btn-secondary bg-transparent border-white/25 text-white hover:bg-white/10">
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <Link href="/sign-in" className="btn-secondary bg-white/10 border-white/20 text-white hover:bg-white/20">
              Sign in
            </Link>
          )}
        </header>

        <div className="relative max-w-3xl mx-auto px-6 pt-10 pb-24 text-center animate-fade-up">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs text-gold-200 mb-6">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            Built by a Vistage Chair, for Vistage Chairs
          </p>
          <h1 className="text-white font-serif text-4xl sm:text-5xl leading-tight mb-5">
            Run your next executive event without touching a spreadsheet.
          </h1>
          <p className="text-navy-200 text-lg max-w-2xl mx-auto mb-9">
            Your contacts, your invitations, your hosted RSVP form, and real-time replies - all in one calm, private
            place. Every invitation still goes out from your own inbox, written in your own voice.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={isSignedIn ? '/dashboard' : '/sign-in'} className="btn-gold">
              {isSignedIn ? 'Go to your dashboard' : 'Sign in to your account'}
            </Link>
            <a href="mailto:hello@chaireventsystem.com" className="btn-secondary bg-transparent border-white/25 text-white hover:bg-white/10">
              Ask about getting set up
            </a>
          </div>
        </div>
      </div>

      {/* ---------- Why this exists ---------- */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-navy-900">Made for how Chairs actually work</h2>
        <p className="text-navy-600 mt-3 leading-relaxed">
          Every Vistage Chair juggles the same thing every event cycle: a contact list that lives in three places, an
          invitation that has to feel personal to a CEO’s inbox, and a spreadsheet tracking who said yes. This was
          built by a working Chair to replace that whole tangle with one tool - nothing enterprise, nothing you have
          to be technical to use.
        </p>
      </section>

      {/* ---------- Features ---------- */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={Users}
            title="One contact list, always"
            description="Import your existing spreadsheet in a few clicks. Every member, prospect, and guest, reused across every event you ever run."
          />
          <FeatureCard
            icon={Sparkles}
            title="A writing assistant that knows the event"
            description="Get a genuinely good first draft grounded in your event's real details, then edit it by hand or just tell it what to change."
          />
          <FeatureCard
            icon={ClipboardList}
            title="A hosted RSVP form, no code"
            description="Drag questions into place, publish, and responses flow straight back to the right person automatically."
          />
          <FeatureCard
            icon={Send}
            title="Sent from your real inbox"
            description="Invitations go out through your own Outlook mailbox, paced like a human, so they land in the inbox - not the spam folder."
          />
          <FeatureCard
            icon={LineChart}
            title="Know who to follow up with"
            description="One dashboard answers who's coming, who's on the fence, and who's worth a personal nudge - no spreadsheet required."
          />
          <FeatureCard
            icon={Check}
            title="Nothing sends without you"
            description="Every draft, every send, is yours to approve. Close your laptop mid-send and it keeps going safely in the background."
          />
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section className="bg-navy-50 border-y border-navy-100">
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <h2 className="text-navy-900">Simple pricing</h2>
          <p className="text-navy-500 text-sm mt-2 mb-6">One flat monthly price - no per-seat or per-contact fees.</p>
          <div className="card p-8">
            <p className="text-4xl font-serif text-navy-950">
              $99<span className="text-lg text-navy-400 font-sans">/month</span>
            </p>
            <p className="text-navy-500 text-sm mt-2 mb-6">Covers hosting, the writing assistant, and upkeep.</p>
            <ul className="text-sm text-navy-700 text-left space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" strokeWidth={2} />
                Unlimited contacts and events
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" strokeWidth={2} />
                Sends through your own mailbox
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-success shrink-0 mt-0.5" strokeWidth={2} />
                The writing assistant, included
              </li>
            </ul>
            <a href="mailto:hello@chaireventsystem.com" className="btn-primary w-full justify-center">
              Get in touch
            </a>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-navy-500">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span>Chair Event System</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/terms" className="hover:text-navy-800">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-navy-800">
            Privacy
          </Link>
          <a href="mailto:hello@chaireventsystem.com" className="hover:text-navy-800">
            Contact
          </a>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="card-interactive p-5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-navy-900 text-gold-300 mb-3">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </div>
      <h3 className="text-navy-900 text-base">{title}</h3>
      <p className="text-navy-500 text-sm mt-1 leading-relaxed">{description}</p>
    </div>
  );
}
