import { useSearchParams } from 'react-router-dom';
import {
  Link,
  Select,
  Skeleton,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { AdminHeader } from '../components/admin/AdminHeader';
import { PaginationNav } from '../components/admin/PaginationNav';
import { QueryErrorCard } from '../components/admin/QueryErrorCard';
import { StatusBadge } from '../components/roast/StatusBadge';
import { STATUS_LABELS, formatRelativeDate, formatScore, scoreColorToken } from '../components/roast/roastUtils';
import { useAdminSubmissions } from '../hooks/useAdmin';
import type { SubmissionStatus } from '../types';

const PAGE_SIZE = 20;
const STATUSES = Object.keys(STATUS_LABELS) as SubmissionStatus[];

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function parseStatus(value: string | null): SubmissionStatus | '' {
  return STATUSES.find((s) => s === value) ?? '';
}

export function AdminSubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const status = parseStatus(searchParams.get('status'));
  const query = useAdminSubmissions(page, PAGE_SIZE, status);
  const items = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const update = (next: { page?: number; status?: SubmissionStatus | '' }) => {
    const nextStatus = next.status ?? status;
    const nextPage = next.page ?? 1;
    const params: Record<string, string> = {};
    if (nextStatus) params.status = nextStatus;
    if (nextPage > 1) params.page = String(nextPage);
    setSearchParams(params);
  };

  return (
    <PageWrapper maxW="container.xl">
      <Stack spacing={8}>
        <AdminHeader title="Submissions" subtitle="Every roast request across the platform, newest first." />

        <Select
          maxW="xs"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => update({ status: parseStatus(e.target.value) })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        {query.isLoading ? (
          <Skeleton h="320px" borderRadius="2xl" aria-busy="true" aria-label="Loading submissions" />
        ) : query.isError ? (
          <QueryErrorCard error={query.error} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <GlassCard disableHover textAlign="center" py={10}>
            <Text color="text.muted">No submissions{status ? ` with status "${STATUS_LABELS[status]}"` : ''} yet.</Text>
          </GlassCard>
        ) : (
          <GlassCard disableHover p={0} overflow="hidden">
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th isNumeric>ID</Th>
                    <Th>Repo</Th>
                    <Th>User</Th>
                    <Th>Status</Th>
                    <Th isNumeric>Score</Th>
                    <Th>Submitted</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((s) => (
                    <Tr key={s.id}>
                      <Td isNumeric color="text.muted">
                        {s.id}
                      </Td>
                      <Td>
                        <Link href={s.repo_url} isExternal color="accent.fg" fontWeight="medium">
                          {s.repo_owner}/{s.repo_name}
                        </Link>
                      </Td>
                      <Td>
                        <Text fontSize="sm">{s.user_email}</Text>
                      </Td>
                      <Td>
                        <Stack spacing={1} align="flex-start">
                          <StatusBadge status={s.status} />
                          {s.error_code && (
                            <Text fontSize="xs" color="text.muted" fontFamily="mono">
                              {s.error_code}
                            </Text>
                          )}
                        </Stack>
                      </Td>
                      <Td isNumeric>
                        {s.overall_score === null ? (
                          <Text color="text.muted">—</Text>
                        ) : (
                          <Text fontWeight="semibold" color={scoreColorToken(s.overall_score)}>
                            {formatScore(s.overall_score)}
                          </Text>
                        )}
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="text.muted">
                          {formatRelativeDate(s.created_at)}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          </GlassCard>
        )}

        <PaginationNav
          page={page}
          totalPages={totalPages}
          isFetching={query.isFetching}
          onChange={(next) => update({ page: next })}
        />
      </Stack>
    </PageWrapper>
  );
}

export default AdminSubmissionsPage;
