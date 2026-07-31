/**
 * Message variation distribution (Part 7.5). Given N recipients and K
 * variants, produce an assignment where variants are interleaved —
 * never large contiguous blocks of one version — so the send never
 * recreates the "identical burst" pattern spam filters watch for.
 */
export function distributeVariants<T>(recipientIds: string[], variants: T[]): Map<string, T> {
  const assignment = new Map<string, T>();
  if (variants.length === 0) return assignment;
  if (variants.length === 1) {
    recipientIds.forEach((id) => assignment.set(id, variants[0]!));
    return assignment;
  }

  // Round-robin over a shuffled variant order per pass, then shuffle the
  // final recipient order so identical variants are never adjacent and no
  // single variant clusters at the start or end of the send.
  const shuffledRecipients = [...recipientIds];
  for (let i = shuffledRecipients.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledRecipients[i], shuffledRecipients[j]] = [shuffledRecipients[j]!, shuffledRecipients[i]!];
  }

  let cursor = 0;
  let lastVariantIndex = -1;

  for (const recipientId of shuffledRecipients) {
    let variantIndex = cursor % variants.length;
    // Avoid back-to-back repeats of the same variant at a boundary.
    if (variantIndex === lastVariantIndex) {
      variantIndex = (variantIndex + 1) % variants.length;
    }
    assignment.set(recipientId, variants[variantIndex]!);
    lastVariantIndex = variantIndex;
    cursor++;
  }

  return assignment;
}
