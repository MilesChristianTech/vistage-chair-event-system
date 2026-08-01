import type { GraphAttachment } from './graph';

// Graph's simple sendMail JSON payload (what this app uses, vs. the more
// complex chunked upload-session API for very large files) caps attachments
// at a few MB — 3MB leaves real headroom under Microsoft's actual limit.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

function guessContentType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

/** Fetches each attachment URL and converts it to the base64 form Graph
 * needs. Best-effort: a file that fails to fetch or is too large is simply
 * dropped (logged) rather than failing the whole send — a missing poster
 * PDF shouldn't block an invitation from going out. */
export async function resolveAttachments(
  refs: { name?: string; url?: string }[]
): Promise<GraphAttachment[]> {
  const results: GraphAttachment[] = [];

  for (const ref of refs) {
    if (!ref?.url) continue;
    try {
      const response = await fetch(ref.url);
      if (!response.ok) {
        console.warn(`[worker] attachment fetch failed (${response.status}): ${ref.url}`);
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        console.warn(`[worker] attachment too large (${buffer.byteLength} bytes), skipping: ${ref.url}`);
        continue;
      }
      results.push({
        name: ref.name?.trim() || ref.url.split('/').pop() || 'attachment',
        contentType: response.headers.get('content-type')?.split(';')[0] || guessContentType(ref.url),
        contentBytes: buffer.toString('base64'),
      });
    } catch (err) {
      console.warn(`[worker] attachment fetch error for ${ref.url}:`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}
