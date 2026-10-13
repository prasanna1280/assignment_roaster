import { Link as RouterLink } from 'react-router-dom';
import {
  Button,
  Flex,
  Heading,
  Link,
  SimpleGrid,
  Skeleton,
  Stack,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
} from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { PageWrapper } from '../components/ui/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { AnimatedList } from '../components/ui/AnimatedList';
import { SubmissionCard } from '../components/roast/SubmissionCard';
import { QuotaBadge } from '../components/roast/QuotaBadge';
import { formatScore, scoreColorToken, toScore } from '../components/roast/roastUtils';
import { useQuota, useSubmissionsList } from '../hooks/useSubmissions';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';
import { brandGradient } from '../theme';
import type { Submission } from '../types';

/** Fetch a batch large enough for a meaningful client-side average. */
const STATS_SAMPLE_SIZE = 50;
const RECENT_COUNT = 5;

function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function averageScore(submissions: Submission[]): number | null {
  const scores = submissions
    .filter((s) => s.status === 'completed' && s.latest_roast)
    .map((s) => toScore(s.latest_roast?.overall_score));
  if (scores.length === 0) return null;
  return scores.reduce((sum, n) => sum + n, 0) / scores.length;
}

export function DashboardPage() {
  const { user } = useAuth();
  const listQuery = useSubmissionsList(1, STATS_SAMPLE_SIZE);
  const quotaQuery = useQuota();

  const items = listQuery.data?.items ?? [];
  const recent = items.slice(0, RECENT_COUNT);
  const avg = averageScore(items);
  const completedCount = items.filter((s) => s.status === 'completed').length;
  const firstName = user?.full_name?.split(' ')[0];
  const quota = quotaQuery.data;
  const remaining = quota ? Math.max(0, quota.limit - quota.used) : null;

  return (
    <PageWrapper maxW="container.xl">
      <Stack spacing={10}>
        <GlassCard disableHover p={{ base: 6, md: 10 }}>
          <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ md: 'center' }} gap={6}>
            <Stack spacing={3}>
              <Text color="text.muted">
                {greeting()}
                {firstName ? `, ${firstName}` : ''} 👋 Vanakkam!
              </Text>
              <Heading as="h1" size="2xl" bgGradient={brandGradient} bgClip="text" lineHeight="1.15">
                Ready for today&apos;s roast?
              </Heading>
              <Text color="text.muted" maxW="lg">
                Paste a public GitHub repo, get a score, a spicy Tanglish roast and fixes ranked by severity.
              </Text>
              <QuotaBadge quota={quota} isLoading={quotaQuery.isLoading} />
            </Stack>
            <GradientButton to="/roast/new" size="lg">
              🔥 Roast a repo
            </GradientButton>
          </Flex>
        </GlassCard>

        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={6}>
          <GlassCard>
            <Stat>
              <StatLabel color="text.muted">Total roasts</StatLabel>
              <Skeleton isLoaded={!listQuery.isLoading}>
                <StatNumber fontSize="3xl">{listQuery.data?.total ?? 0}</StatNumber>
              </Skeleton>
              <StatHelpText>{completedCount} completed recently</StatHelpText>
            </Stat>
          </GlassCard>
          <GlassCard>
            <Stat>
              <StatLabel color="text.muted">Average score</StatLabel>
              <Skeleton isLoaded={!listQuery.isLoading}>
                <StatNumber fontSize="3xl" color={avg === null ? 'text.muted' : scoreColorToken(avg)} data-testid="avg-score">
                  {avg === null ? '—' : `${formatScore(Math.round(avg * 10) / 10)} / 10`}
                </StatNumber>
              </Skeleton>
              <StatHelpText>
                {avg === null ? 'No completed roasts yet' : `Across your last ${completedCount} roasts`}
              </StatHelpText>
            </Stat>
          </GlassCard>
          <GlassCard>
            <Stat>
              <StatLabel color="text.muted">Roasts left today</StatLabel>
              <Skeleton isLoaded={!quotaQuery.isLoading}>
                <StatNumber fontSize="3xl">{remaining === null ? '—' : `${remaining} / ${quota?.limit ?? 0}`}</StatNumber>
              </Skeleton>
              <StatHelpText>Resets daily</StatHelpText>
            </Stat>
          </GlassCard>
        </SimpleGrid>

        <Stack spacing={5}>
          <Flex justify="space-between" align="center">
            <Heading as="h2" size="lg">
              Recent roasts
            </Heading>
            {recent.length > 0 && (
              <Link as={RouterLink} to="/submissions" color="accent.fg" fontWeight="semibold">
                View all →
              </Link>
            )}
          </Flex>

          {listQuery.isLoading ? (
            <Stack spacing={4} aria-busy="true" aria-label="Loading recent roasts">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} h="96px" borderRadius="2xl" />
              ))}
            </Stack>
          ) : listQuery.isError ? (
            <GlassCard disableHover role="alert">
              <Stack spacing={4} align="flex-start">
                <Text>{getErrorMessage(listQuery.error)}</Text>
                <Button leftIcon={<FiRefreshCw aria-hidden="true" />} onClick={() => void listQuery.refetch()}>
                  Try again
                </Button>
              </Stack>
            </GlassCard>
          ) : recent.length === 0 ? (
            <GlassCard disableHover textAlign="center" py={12}>
              <Stack spacing={4} align="center">
                <Text fontSize="4xl" aria-hidden="true">
                  🌶️
                </Text>
                <Text color="text.muted">Innum roast pannala. First repo submit pannu, machaan!</Text>
                <GradientButton to="/roast/new">Roast my first repo</GradientButton>
              </Stack>
            </GlassCard>
          ) : (
            <AnimatedList spacing={4}>
              {recent.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))}
            </AnimatedList>
          )}
        </Stack>
      </Stack>
    </PageWrapper>
  );
}

export default DashboardPage;
