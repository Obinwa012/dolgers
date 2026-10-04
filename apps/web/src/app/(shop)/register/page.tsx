import type { Metadata } from 'next';
import { AuthCard } from '@/components/account/AuthCard';
import { RegisterForm } from '@/components/account/RegisterForm';
import { safeNext } from '@/components/account/authHelpers';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false, follow: true } };

export default async function RegisterPage(props: PageProps<'/register'>) {
  const { next } = await props.searchParams;
  return (
    <AuthCard eyebrow="Join DOLGERS" title="Create an account" intro="One account for every independent label on DOLGERS: orders, returns, saved addresses and your wishlist.">
      <RegisterForm next={safeNext(next)} />
    </AuthCard>
  );
}
