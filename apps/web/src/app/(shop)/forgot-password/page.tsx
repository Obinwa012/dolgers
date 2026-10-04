import type { Metadata } from 'next';
import { AuthCard } from '@/components/account/AuthCard';
import { ForgotPasswordForm } from '@/components/account/ForgotPasswordForm';
import { safeNext } from '@/components/account/authHelpers';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false, follow: true } };

export default async function ForgotPasswordPage(props: PageProps<'/forgot-password'>) {
  const { next } = await props.searchParams;
  return (
    <AuthCard eyebrow="Your account" title="Reset your password" intro="Enter the email you use with DOLGERS and we will send you a link to choose a new password.">
      <ForgotPasswordForm next={safeNext(next)} />
    </AuthCard>
  );
}
