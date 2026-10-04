'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

export function RouteDrawer({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = () => router.back();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, [title]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (!first || !last) return;

    if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="route-drawer-layer" role="presentation">
      <button type="button" className="route-drawer-backdrop" aria-label="Dismiss drawer" onClick={closeDrawer} />
      <section
        key={title}
        ref={panelRef}
        className="route-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-drawer-title"
        onKeyDown={onKeyDown}
      >
        <h2 id="route-drawer-title" className="sr-only">{title}</h2>
        <div className="route-drawer-toolbar">
          <span className="label text-muted">DOLGERS</span>
          <button ref={closeRef} type="button" className="route-drawer-close" aria-label={`Close ${title}`} onClick={closeDrawer}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="route-drawer-content">{children}</div>
      </section>
    </div>
  );
}

export function DrawerLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!document.querySelector('.route-drawer-panel') || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.replace(href);
  };

  return <Link href={href} className={className} onClick={navigate}>{children}</Link>;
}
