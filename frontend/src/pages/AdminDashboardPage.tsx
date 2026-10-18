import { Heading, SimpleGrid, Skeleton, Stack, Stat, StatHelpText, StatLabel, StatNumber, Wrap, WrapItem } from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { SectionCard } from '../components/ui/SectionCard';
import { AdminHeader } from '../components/admin/AdminHeader';
import { QueryErrorCard } from '../components/admin/QueryErrorCard';
import { RoastsPerDayChart } from '../components/admin/RoastsPerDayChart';
import { StatusBadge } from '../components/roast/StatusBadge';
import { formatScore } from '../components/roast/roastUtils';
import { useAdminStats } from '../hooks/useAdmin';
import type { SubmissionStatus } from '../types';

const STATUS_ORDER: SubmissionStatus[] = ['queued', 'fetching', 'analyzing', 'completed', 'failed'];

const numberFormat = new Intl.NumberFormat('en-US');

interface StatCardProps {
  label: string;
  value: string;
  help: string;
}

function StatCard({ label, value, help }: StatCardProps) {
  return (
    <SectionCard>
      <Stat>
        <StatLabel color="text.muted">{label}</StatLabel>
        <StatNumber fontSize="3xl">{value}</StatNumber>
        <StatHelpText>{help}</StatHelpText>
      </Stat>
    </SectionCard>
  );
}

export function AdminDashboardPage() {
  const query = useAdminStats();
  const stats = query.data;

  return (
    <PageWrapper maxW="container.xl">
      <Stack spacing={8}>
        <AdminHeader title="Platform overview" subtitle="Users, roasts, failures and token spend at a glance." />

        {query.isLoading ? (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={6} aria-busy="true" aria-label="Loading stats">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h="120px" borderRadius="lg" />
            ))}
          </SimpleGrid>
        ) : query.isError || !stats ? (
          <QueryErrorCard error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={6}>
              <StatCard
                label="Users"
                value={numberFormat.format(stats.total_users)}
                help={`${numberFormat.format(stats.active_users)} active`}
              />
              <StatCard
                label="Roasts"
                value={numberFormat.format(stats.total_roasts)}
                help={`${numberFormat.format(stats.roasts_today)} today (UTC)`}
              />
              <StatCard
                label="Average score"
                value={stats.average_score === null ? '—' : `${formatScore(stats.average_score)} / 10`}
                help="Across all roasts"
              />
              <StatCard
                label="Failure rate"
                value={`${(stats.failure_rate * 100).toFixed(1)}%`}
                help={`${numberFormat.format(stats.submissions_by_status.failed)} of ${numberFormat.format(
                  stats.submissions_by_status.failed + stats.submissions_by_status.completed,
                )} finished`}
              />
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <SectionCard>
                <Stack spacing={4}>
                  <Heading as="h2" size="md">
                    Roasts per day
                  </Heading>
                  <RoastsPerDayChart data={stats.roasts_per_day} />
                </Stack>
              </SectionCard>

              <Stack spacing={6}>
                <SectionCard>
                  <Stack spacing={4}>
                    <Heading as="h2" size="md">
                      Submissions by status
                    </Heading>
                    <Wrap spacing={4}>
                      {STATUS_ORDER.map((status) => (
                        <WrapItem key={status} alignItems="center" gap={2}>
                          <StatusBadge status={status} />
                          <Heading as="span" size="sm">
                            {numberFormat.format(stats.submissions_by_status[status])}
                          </Heading>
                        </WrapItem>
                      ))}
                    </Wrap>
                  </Stack>
                </SectionCard>
                <SimpleGrid columns={2} spacing={6}>
                  <StatCard
                    label="Input tokens"
                    value={numberFormat.format(stats.total_input_tokens)}
                    help="All time"
                  />
                  <StatCard
                    label="Output tokens"
                    value={numberFormat.format(stats.total_output_tokens)}
                    help="All time"
                  />
                </SimpleGrid>
              </Stack>
            </SimpleGrid>
          </>
        )}
      </Stack>
    </PageWrapper>
  );
}

export default AdminDashboardPage;
