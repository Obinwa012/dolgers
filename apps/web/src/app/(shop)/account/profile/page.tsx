import type { Metadata } from 'next';
import { ProfileView } from '@/components/account/ProfileView';

export const metadata: Metadata = { title: 'Profile' };

export default function AccountProfilePage() {
  return <ProfileView />;
}
