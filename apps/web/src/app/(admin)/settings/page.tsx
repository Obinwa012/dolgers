import { PageHeader, Tabs } from '@/components/ui.tsx';
import { DEFAULT_MODELS } from '@/core/ai/claude.ts';
import { US_FEEDS } from '@/core/stages.ts';
import { DEFAULT_CONFIG } from '@/core/vetting/config.ts';
import { listAdmins, requireAdmin } from '@/server/auth.ts';
import { siteUrl } from '@/server/context.ts';
import { repo } from '@/server/firebase.ts';
import { setupStatus } from '@/server/queries.ts';
import { AdminsSettings } from './AdminsSettings.tsx';
import { AliExpressSettings } from './AliExpressSettings.tsx';
import { ClaudeSettings } from './ClaudeSettings.tsx';
import { DolgersSettings } from './DolgersSettings.tsx';

export const metadata = { title: 'Settings' };

const TABS = [
  { key: 'aliexpress', label: 'AliExpress' },
  { key: 'claude', label: 'Claude' },
  { key: 'dolgers', label: 'DOLGERS rules' },
  { key: 'admins', label: 'Admins' },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; connected?: string; error?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'aliexpress';
  const me = await requireAdmin();
  const [setup, settings, config] = await Promise.all([setupStatus(), repo().settings(), repo().loadConfig()]);

  return (
    <>
      <PageHeader title="Settings" sub="Keys are stored in your Firestore database on the server and never sent back to the browser." />
      <Tabs current={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, href: `/settings?tab=${t.key}` }))} />
      {tab === 'aliexpress' && (
        <AliExpressSettings setup={setup} callbackUrl={`${siteUrl()}/api/auth/ae/callback`} connected={!!sp.connected} error={sp.error?.slice(0, 200) ?? null} />
      )}
      {tab === 'claude' && (
        <ClaudeSettings
          keyHint={setup.claudeKeyHint}
          fast={settings.aiModels?.fast || DEFAULT_MODELS.fast}
          careful={settings.aiModels?.careful || DEFAULT_MODELS.careful}
          defaults={DEFAULT_MODELS}
        />
      )}
      {tab === 'dolgers' && (
        <DolgersSettings
          config={config}
          defaults={DEFAULT_CONFIG}
          feeds={settings.feeds?.length ? settings.feeds : US_FEEDS}
          defaultFeeds={US_FEEDS}
          importPages={settings.importPages ?? 5}
        />
      )}
      {tab === 'admins' && <AdminsSettings admins={await listAdmins()} me={me.uid} />}
    </>
  );
}
