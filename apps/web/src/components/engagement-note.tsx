// Part 8.3: engagement signals must always carry this clarifying note,
// verbatim wherever they appear, so the Host never mistakes a soft signal
// for a hard fact.
export default function EngagementNote() {
  return (
    <p className="text-xs text-navy-400 mb-6">
      Open and click signals are approximate — privacy features and corporate mail scanners both create false
      positives — so treat them as a soft hint about who’s engaged, never as certainty.
    </p>
  );
}
