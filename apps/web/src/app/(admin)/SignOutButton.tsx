'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/server/actions/auth.ts';

export function SignOutButton({ dark = false }: { dark?: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={`mt-1 font-semibold underline-offset-2 hover:underline ${dark ? 'text-denim' : 'text-paper/80'}`}
      onClick={async () => {
        await signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
