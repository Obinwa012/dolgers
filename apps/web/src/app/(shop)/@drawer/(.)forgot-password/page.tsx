import { AuthCard } from '@/components/account/AuthCard';
import { ForgotPasswordForm } from '@/components/account/ForgotPasswordForm';
import { RouteDrawer } from '@/components/RouteDrawer';
import { safeNext } from '@/components/account/authHelpers';

export default async function ForgotPasswordDrawerPage(props: PageProps<'/forgot-password'>) {
  const { next } = await props.searchParams;
  return (
    <RouteDrawer title="Reset your password">
      <AuthCard eyebrow="Your account" title="Reset your password" intro="Enter the email you use with DOLGERS and we will send you a link to choose a new password." compact>
        <ForgotPasswordForm next={safeNext(next)} />
      </AuthCard>
    </RouteDrawer>
  );
}
