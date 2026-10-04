import { AuthCard } from '@/components/account/AuthCard';
import { SignInForm } from '@/components/account/SignInForm';
import { RouteDrawer } from '@/components/RouteDrawer';
import { safeNext } from '@/components/account/authHelpers';

export default async function SignInDrawerPage(props: PageProps<'/sign-in'>) {
  const { next } = await props.searchParams;
  return (
    <RouteDrawer title="Sign in">
      <AuthCard eyebrow="Your account" title="Sign in" intro="Track orders from every maker in one place, keep your wishlist, and check out faster." compact>
        <SignInForm next={safeNext(next)} />
      </AuthCard>
    </RouteDrawer>
  );
}
