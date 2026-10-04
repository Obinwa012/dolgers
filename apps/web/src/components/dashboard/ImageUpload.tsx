'use client';

import { getMetadata, ref, uploadBytes } from 'firebase/storage';
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ProductImage as Img } from '@dolgers/shared';
import { ProductImage } from '@/components/ProductImage';
import { publicEnv } from '@/lib/env';
import { firebase } from '@/lib/firebase/client';

/** Where an upload goes: a vendor's own folder, or the admin folder. */
export type UploadTarget = { kind: 'vendor'; vendorId: string } | { kind: 'admin' };

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 15 * 1024 * 1024;
const PUBLIC_WIDTH = 1600;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomId(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function measure(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const width = Math.min(PUBLIC_WIDTH, bmp.width);
    const height = Math.round((bmp.height * width) / bmp.width);
    bmp.close();
    return { width, height };
  } catch {
    return {};
  }
}

/** Checks a file before upload. Returns an error sentence or null. */
export function checkImageFile(file: File): string | null {
  if (!TYPES[file.type]) return `${file.name} is not a JPEG, PNG or WebP image.`;
  if (file.size >= MAX_BYTES) return `${file.name} is larger than 15MB.`;
  return null;
}

/**
 * Uploads an original to uploads/…, then waits for the onImageUploaded function to publish the
 * re-encoded WebP under public/…, and returns its public URL.
 */
export async function uploadImage(file: File, target: UploadTarget, alt = ''): Promise<Img> {
  const fb = firebase();
  if (!fb) throw new Error('Uploads need Firebase.');
  const problem = checkImageFile(file);
  if (problem) throw new Error(problem);

  const id = randomId();
  const folder = target.kind === 'vendor' ? `vendors/${target.vendorId}` : 'admin';
  const size = await measure(file);
  await uploadBytes(ref(fb.storage, `uploads/${folder}/${id}.${TYPES[file.type]}`), file, { contentType: file.type });

  const publicPath = `public/${folder}/${id}-${PUBLIC_WIDTH}.webp`;
  const publicRef = ref(fb.storage, publicPath);
  const deadline = Date.now() + 120_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      await getMetadata(publicRef);
      ready = true;
      break;
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code !== 'storage/object-not-found') throw err;
      await wait(1500);
    }
  }
  if (!ready) throw new Error(`We could not process ${file.name}. Try a different photo.`);

  const bucket = fb.storage.app.options.storageBucket ?? publicEnv.firebase.storageBucket;
  const host = publicEnv.useEmulators ? 'http://127.0.0.1:9199' : 'https://firebasestorage.googleapis.com';
  return { url: `${host}/v0/b/${bucket}/o/${encodeURIComponent(publicPath)}?alt=media`, alt, ...size };
}

/** A single image with alt text: banners, story images, home page tiles. */
export function ImageField({
  label,
  value,
  onChange,
  target,
  aspect = 'aspect-[16/9]',
}: {
  label: string;
  value: Img | null;
  onChange: (img: Img | null) => void;
  target: UploadTarget;
  aspect?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const img = await uploadImage(file, target, value?.alt ?? '');
      onChange(img);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <fieldset className="min-w-0">
      <legend className="field-label">{label}</legend>
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className={`relative ${aspect} w-full border border-line`}>
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-stone text-xs text-muted" role="status">Processing photo…</div>
          ) : value ? (
            <ProductImage image={value} sizes="220px" className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-cream text-xs text-faint">No image</div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor={`${id}-alt`} className="field-label">Alt text</label>
            <input
              id={`${id}-alt`}
              className="field"
              value={value?.alt ?? ''}
              maxLength={200}
              disabled={!value}
              placeholder="Describe the photo for screen readers"
              onChange={(e) => value && onChange({ ...value, alt: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              id={`${id}-file`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            <button type="button" className="btn btn-secondary min-h-9 px-4" disabled={busy} onClick={() => input.current?.click()}>
              {value ? 'Replace' : 'Upload'}
            </button>
            {value ? (
              <button type="button" className="btn min-h-9 px-4 text-muted hover:text-ink" disabled={busy} onClick={() => onChange(null)}>
                Remove
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted">JPEG, PNG or WebP, under 15MB.</p>
          {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
        </div>
      </div>
    </fieldset>
  );
}

/** Ordered product gallery: upload several, write alt text, reorder, remove. */
export function ImageGallery({
  images,
  onChange,
  target,
  max = 12,
}: {
  images: Img[];
  onChange: (next: Img[] | ((prev: Img[]) => Img[])) => void;
  target: UploadTarget;
  max?: number;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, max - images.length - pending.length));
    setErrors([]);
    if (list.length < files.length) setErrors([`A product can have up to ${max} photos.`]);
    await Promise.all(
      list.map(async (file) => {
        const key = `${file.name}-${randomId(6)}`;
        setPending((p) => [...p, key]);
        try {
          const img = await uploadImage(file, target, '');
          onChange((prev) => [...prev, img]);
        } catch (err) {
          setErrors((e) => [...e, err instanceof Error ? err.message : `Upload of ${file.name} failed.`]);
        } finally {
          setPending((p) => p.filter((k) => k !== key));
        }
      }),
    );
    if (input.current) input.current.value = '';
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li key={`${img.url}-${i}`} className="min-w-0">
            <div className="relative aspect-[3/4] border border-line">
              <ProductImage image={img} sizes="200px" className="absolute inset-0" showLabel={false} />
              {i === 0 ? <span className="label absolute left-2 top-2 bg-paper px-1.5 py-0.5 text-[9px]">Cover</span> : null}
              <div className="absolute right-1 top-1 flex gap-1">
                <button type="button" className="bg-paper p-1.5 disabled:opacity-30" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowLeft size={14} />
                </button>
                <button type="button" className="bg-paper p-1.5 disabled:opacity-30" aria-label={`Move photo ${i + 1} later`} disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                  <ArrowRight size={14} />
                </button>
                <button type="button" className="bg-paper p-1.5" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(images.filter((_, k) => k !== i))}>
                  <X size={14} />
                </button>
              </div>
            </div>
            <label htmlFor={`${id}-alt-${i}`} className="sr-only">Alt text for photo {i + 1}</label>
            <input
              id={`${id}-alt-${i}`}
              className="field mt-2 min-h-9 text-xs"
              placeholder="Alt text, e.g. Front view, navy"
              maxLength={200}
              value={img.alt}
              onChange={(e) => onChange(images.map((im, k) => (k === i ? { ...im, alt: e.target.value } : im)))}
            />
          </li>
        ))}
        {pending.map((key) => (
          <li key={key} className="relative flex aspect-[3/4] items-center justify-center border border-line bg-stone text-xs text-muted" role="status">
            Processing photo…
          </li>
        ))}
        {images.length + pending.length < max ? (
          <li>
            <input
              ref={input}
              id={`${id}-files`}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void upload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong text-muted transition-colors hover:border-ink hover:text-ink"
            >
              <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
              <span className="label">Add photos</span>
            </button>
          </li>
        ) : null}
      </ul>
      <p className="mt-3 text-xs text-muted">JPEG, PNG or WebP under 15MB each. The first photo is the cover. Photos are re-encoded and stripped of metadata before they go live.</p>
      {errors.map((e) => <p key={e} role="alert" className="mt-1 text-xs text-danger">{e}</p>)}
    </div>
  );
}
