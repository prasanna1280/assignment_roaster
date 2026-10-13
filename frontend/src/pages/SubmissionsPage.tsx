import { useSearchParams } from 'react-router-dom';
import { Button, Flex, Heading, HStack, Skeleton, Stack, Text } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import { PageWrapper } from '../components/ui/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { AnimatedList } from '../components/ui/AnimatedList';
import { SubmissionCard } from '../components/roast/SubmissionCard';
import { useSubmissionsList } from '../hooks/useSubmissions';
import { getErrorMessage } from '../services/api';

const PAGE_SIZE = 10;

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function SubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const query = useSubmissionsList(page, PAGE_SIZE);

  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = query.data?.items ?? [];

  const goToPage = (next: number) => {
    setSearchParams(next === 1 ? {} : { page: String(next) });
  };

  return (
    <PageWrapper>
      <Stack spacing={8}>
        <Flex justify="space-between" align={{ base: 'flex-start', sm: 'center' }} gap={4} direction={{ base: 'column', sm: 'row' }}>
          <Stack spacing={1}>
            <Heading as="h1" size="xl">
              My roasts
            </Heading>
            <Text color="text.muted">
              {total > 0 ? `${total} roast${total === 1 ? '' : 's'} so far. Keep cooking!` : 'Un roast history inga varum.'}
            </Text>
          </Stack>
          <GradientButton to="/roast/new">🔥 New roast</GradientButton>
        </Flex>

        {query.isLoading ? (
          <Stack spacing={4} aria-busy="true" aria-label="Loading roasts">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h="96px" borderRadius="2xl" />
            ))}
          </Stack>
        ) : query.isError ? (
          <GlassCard disableHover role="alert">
            <Stack spacing={4} align="flex-start">
              <Text>{getErrorMessage(query.error)}</Text>
              <Button leftIcon={<FiRefreshCw aria-hidden="true" />} onClick={() => void query.refetch()}>
                Try again
              </Button>
            </Stack>
          </GlassCard>
        ) : items.length === 0 ? (
          <GlassCard disableHover textAlign="center" py={14}>
            <Stack spacing={4} align="center">
              <Text fontSize="5xl" aria-hidden="true">
                🍳
              </Text>
              <Heading as="h2" size="md">
                Innum oru roast kooda illa!
              </Heading>
              <Text color="text.muted" maxW="md">
                Submit your first assignment repo and get honest, spicy feedback in under a minute.
              </Text>
              <GradientButton to="/roast/new">Roast my first repo</GradientButton>
            </Stack>
          </GlassCard>
        ) : (
          <AnimatedList spacing={4}>
            {items.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </AnimatedList>
        )}

        {totalPages > 1 && (
          <HStack as="nav" aria-label="Pagination" justify="center" spacing={4}>
            <Button
              leftIcon={<FiChevronLeft aria-hidden="true" />}
              variant="outline"
              onClick={() => goToPage(page - 1)}
              isDisabled={page <= 1 || query.isFetching}
            >
              Previous
            </Button>
            <Text color="text.muted" aria-live="polite">
              Page {page} of {totalPages}
            </Text>
            <Button
              rightIcon={<FiChevronRight aria-hidden="true" />}
              variant="outline"
              onClick={() => goToPage(page + 1)}
              isDisabled={page >= totalPages || query.isFetching}
            >
              Next
            </Button>
          </HStack>
        )}
      </Stack>
    </PageWrapper>
  );
}

export default SubmissionsPage;
