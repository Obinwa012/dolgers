import { AuthCard } from '@/components/account/AuthCard';
import { RegisterForm } from '@/components/account/RegisterForm';
import { RouteDrawer } from '@/components/RouteDrawer';
import { safeNext } from '@/components/account/authHelpers';

export default async function RegisterDrawerPage(props: PageProps<'/register'>) {
  const { next } = await props.searchParams;
  return (
    <RouteDrawer title="Create an account">
      <AuthCard eyebrow="Join DOLGERS" title="Create an account" intro="One account for every independent label on DOLGERS: orders, returns, saved addresses and your wishlist." compact>
        <RegisterForm next={safeNext(next)} />
      </AuthCard>
    </RouteDrawer>
  );
}
