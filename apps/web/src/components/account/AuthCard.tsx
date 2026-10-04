import type { ReactNode } from 'react';

/** Centered, narrow column used by sign-in, register and password reset. */
export function AuthCard({ eyebrow, title, intro, children, compact = false }: { eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? 'w-full px-6 py-8 md:px-8 md:py-10' : 'container-page py-14 md:py-24'}>
      <div className="mx-auto w-full max-w-[440px]">
        {eyebrow ? <p className="label text-muted">{eyebrow}</p> : null}
        <h1 className="display mt-3 text-[40px] md:text-[48px]">{title}</h1>
        {intro ? <div className="mt-4 text-sm leading-relaxed text-muted">{intro}</div> : null}
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
