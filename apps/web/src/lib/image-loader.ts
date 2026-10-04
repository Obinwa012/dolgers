// Product photos are stored pre-resized at 480, 960 and 1600px (see the onImageUploaded
// function). This loader picks the smallest stored size that covers the requested width, so
// images are never resized on demand.
const WIDTHS = [480, 960, 1600];

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  const match = src.match(/-(480|960|1600)\.webp/);
  if (!match) {
    if (!src.startsWith('https://images.pexels.com/')) return src;
    const url = new URL(src);
    url.searchParams.set('w', String(Math.min(width, 2400)));
    return url.toString();
  }
  const pick = WIDTHS.find((w) => w >= width) ?? 1600;
  return src.replace(match[0], `-${pick}.webp`);
}
