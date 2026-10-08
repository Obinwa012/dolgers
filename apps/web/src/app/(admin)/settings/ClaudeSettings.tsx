'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { btn, Card, Field, input } from '@/components/ui.tsx';
import type { AiModels } from '@/core/ai/claude.ts';
import { saveClaude, testClaude } from '@/server/actions/settings.ts';

export function ClaudeSettings({ keyHint, fast, careful, defaults }: { keyHint: string | null; fast: string; careful: string; defaults: AiModels }) {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [m, setM] = useState({ fast, careful });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      {msg && <p role="status" className={`rounded-md px-4 py-2 text-sm lg:col-span-2 ${msg.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>{msg.text}</p>}
      <Card title="Claude API">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setMsg(null);
              const r = await saveClaude(key, m.fast, m.careful);
              setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error });
              if (r.ok) {
                setKey('');
                router.refresh();
              }
            });
          }}
        >
          <Field label="API key" hint={keyHint ? `Saved (ends ${keyHint.slice(-4)}). Leave blank to keep it.` : 'Create one at console.anthropic.com → API keys.'}>
            <input className={input} type="password" autoComplete="new-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={keyHint ? '••••••••' : 'sk-ant-…'} />
          </Field>
          <Field label="Model for reading reviews and checking photos" hint={`Default: ${defaults.fast}`}>
            <input className={input} value={m.fast} onChange={(e) => setM({ ...m, fast: e.target.value })} />
          </Field>
          <Field label="Model for size guides and listings" hint={`Default: ${defaults.careful}`}>
            <input className={input} value={m.careful} onChange={(e) => setM({ ...m, careful: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className={btn.primary} disabled={pending}>Save</button>
            <button
              type="button"
              className={btn.secondary}
              disabled={pending || !keyHint}
              onClick={() =>
                start(async () => {
                  setMsg(null);
                  const r = await testClaude();
                  setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
                })
              }
            >
              {pending ? 'Working…' : 'Test'}
            </button>
          </div>
        </form>
      </Card>
      <Card title="What Claude does">
        <ul className="list-disc space-y-1.5 pl-5 text-ink-soft">
          <li>Reads every written review and lists real problems, each with a quote that is checked against the review.</li>
          <li>Looks at the product photos for brand logos, celebrities and characters.</li>
          <li>Reads the seller’s size chart and builds a US size guide using US buyers’ fit comments.</li>
          <li>Writes the US listing and SEO. Every claim must trace to evidence; the code rejects “Made in USA” and brand names.</li>
        </ul>
        <p className="mt-3 text-ink-soft">Claude only finds and quotes. The import, hold and reject decisions are made by fixed rules you control under DOLGERS rules.</p>
      </Card>
    </div>
  );
}
