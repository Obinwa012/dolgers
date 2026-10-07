import { requireAdminPage } from '@/lib/admin-auth';
import Dashboard from './dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  await requireAdminPage();
  return <Dashboard />;
}
