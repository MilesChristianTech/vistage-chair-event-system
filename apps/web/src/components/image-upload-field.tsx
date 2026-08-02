'use client';

import { useRef, useState } from 'react';
import { uploadBrandingImageAction } from '@/lib/storage-actions';

/** A file picker that uploads immediately on selection and exposes the
 * resulting public URL via a hidden input (so it drops into an existing
 * plain <form> the same way a text field would) plus onUploaded for
 * components managing their own state instead. Replaces "paste a URL" for
 * branding images - a pasted local file path (easy to grab by mistake from
 * Windows Explorer) can never actually be loaded by a browser other than
 * the one that copied it. */
export default function ImageUploadField({
  name,
  label,
  value,
  onUploaded,
}: {
  name: string;
  label: string;
  value: string;
  onUploaded?: (url: string) => void;
}) {
  const [url, setUrl] = useState(value);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.set('file', file);
    const result = await uploadBrandingImageAction(formData);
    setIsUploading(false);
    if (!result.ok || !result.url) {
      setError(result.error || 'Could not upload that image.');
      return;
    }
    setUrl(result.url);
    onUploaded?.(result.url);
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-12 max-w-[160px] object-contain rounded border border-navy-100 bg-white" />
        ) : (
          <div className="h-12 w-20 rounded border border-dashed border-navy-200 flex items-center justify-center text-navy-300 text-xs">
            None
          </div>
        )}
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        </button>
        {url ? (
          <button
            type="button"
            className="btn-ghost text-xs text-danger"
            onClick={() => {
              setUrl('');
              onUploaded?.('');
            }}
          >
            Remove
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error ? <p className="text-xs text-danger mt-1">{error}</p> : null}
    </div>
  );
}
