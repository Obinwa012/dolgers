import { getAdminUsers, requireAdminPage } from '@/lib/admin-auth';
import SettingsForm from './settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdminPage();
  const admins = await getAdminUsers();
  return <SettingsForm admins={admins} />;
}
