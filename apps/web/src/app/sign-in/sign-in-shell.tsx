'use client';

import { motion } from 'framer-motion';

// The one place this product gets to make a first impression — still the
// minimal, no-marketing front door the spec requires (2.5/10.4), just
// executed with more depth: an animated aurora field instead of a flat
// navy fill, a glass-edged mark, and a soft entrance instead of a hard cut.
export default function SignInShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-975 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-aurora-navy animate-aurora" aria-hidden />
      <div className="absolute inset-0 bg-grid-lines bg-[length:42px_42px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black_10%,transparent_75%)]" aria-hidden />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-5"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold-200 via-gold-400 to-gold-600 shadow-glow" />
            <div className="absolute inset-[1.5px] rounded-[15px] bg-gradient-to-br from-navy-900 to-navy-950" />
            <span className="relative font-serif text-2xl bg-gradient-to-br from-gold-200 to-gold-400 bg-clip-text text-transparent">
              C
            </span>
          </motion.div>
          <h1 className="text-white font-serif text-2xl">Chair Event System</h1>
          <p className="text-navy-300 text-sm mt-1.5">Sign in to continue</p>
        </div>

        <div className="relative rounded-xl p-[1px] bg-gradient-to-b from-white/25 via-white/10 to-transparent shadow-glow-navy">
          <div className="rounded-[11px] bg-white p-6">{children}</div>
        </div>

        <p className="text-center text-navy-400 text-xs mt-6">
          Access is by invitation only. Contact your administrator if you need an account.
        </p>
      </motion.div>
    </main>
  );
}
