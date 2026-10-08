import { PageHeader } from '@/components/ui.tsx';
import { US_FEEDS } from '@/core/stages.ts';
import { repo } from '@/server/firebase.ts';
import { candidateCounts, setupStatus } from '@/server/queries.ts';
import { Runner } from './Runner.tsx';
import { requireAdmin } from '@/server/auth.ts';

export const metadata = { title: 'Import & vet' };

export default async function RunPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  await requireAdmin();
  const { job: jobId } = await searchParams;
  const [jobs, settings, setup, counts] = await Promise.all([repo().listJobs(25), repo().settings(), setupStatus(), candidateCounts()]);
  const selected = jobId ? (jobs.find((j) => j.id === jobId) ?? (await repo().getJob(jobId))) : null;
  const missing = [
    !setup.aeKeys && 'AliExpress app key and secret',
    !setup.aeConnected && 'an AliExpress connection',
    !setup.claudeKey && 'a Claude API key (needed for vetting)',
  ].filter(Boolean) as string[];
  return (
    <>
      <PageHeader
        title="Import & vet"
        sub="Import pulls men’s clothing from the US-warehouse feeds into the queue. Vetting checks each item’s listing, shipping, seller and reviews, then writes the US listing. Keep this tab open while a job runs; closing it pauses the job and you can resume later."
      />
      <Runner
        initialJobs={jobs}
        selected={selected}
        feeds={settings.feeds?.length ? settings.feeds : US_FEEDS}
        importPages={settings.importPages ?? 5}
        waiting={counts.new}
        missing={missing}
      />
    </>
  );
}
