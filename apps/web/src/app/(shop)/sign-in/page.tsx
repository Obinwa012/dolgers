import type { Metadata } from 'next';
import { AuthCard } from '@/components/account/AuthCard';
import { SignInForm } from '@/components/account/SignInForm';
import { safeNext } from '@/components/account/authHelpers';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: true } };

export default async function SignInPage(props: PageProps<'/sign-in'>) {
  const { next } = await props.searchParams;
  return (
    <AuthCard eyebrow="Your account" title="Sign in" intro="Track orders from every maker in one place, keep your wishlist, and check out faster.">
      <SignInForm next={safeNext(next)} />
    </AuthCard>
  );
}
