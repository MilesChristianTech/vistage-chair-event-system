'use client';

import { motion } from 'framer-motion';
import CountUp from './count-up';

// `icon` is a rendered ReactNode, not a component reference — component
// references (functions) can't cross the Server -> Client Component
// boundary, only already-rendered elements/nodes can.
export default function StatCard({
  label,
  value,
  icon,
  accent = 'navy',
  index = 0,
  suffix,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: 'navy' | 'gold' | 'success' | 'danger';
  index?: number;
  suffix?: string;
}) {
  const accentClasses = {
    navy: 'from-navy-700 to-navy-900 text-navy-50',
    gold: 'from-gold-300 to-gold-500 text-navy-950',
    success: 'from-emerald-400 to-success text-white',
    danger: 'from-rose-400 to-danger text-white',
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="card-interactive p-4 flex items-center gap-3.5"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${accentClasses} shadow-glow-navy`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-navy-950 leading-tight tabular-nums">
          <CountUp value={value} />
          {suffix}
        </p>
        <p className="text-xs text-navy-500 truncate">{label}</p>
      </div>
    </motion.div>
  );
}
