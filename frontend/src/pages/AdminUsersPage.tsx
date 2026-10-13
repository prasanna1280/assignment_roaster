import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { PageWrapper } from '../components/ui/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { AdminHeader } from '../components/admin/AdminHeader';
import { PaginationNav } from '../components/admin/PaginationNav';
import { QueryErrorCard } from '../components/admin/QueryErrorCard';
import { formatRelativeDate } from '../components/roast/roastUtils';
import { useAdminUsers, useUpdateAdminUser } from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';
import type { AdminUser, AdminUserUpdate } from '../types';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const search = searchParams.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) setSearchParams(trimmed ? { q: trimmed } : {});
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput, search, setSearchParams]);

  const query = useAdminUsers(page, PAGE_SIZE, search);
  const updateUser = useUpdateAdminUser();
  const items = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE));

  const goToPage = (next: number) => {
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (next > 1) params.page = String(next);
    setSearchParams(params);
  };

  const handleToggle = async (target: AdminUser, payload: AdminUserUpdate) => {
    try {
      await updateUser.mutateAsync({ id: target.id, payload });
      toast({ status: 'success', title: `Updated ${target.email}`, duration: 3000 });
    } catch (err) {
      toast({ status: 'error', title: 'Update failed', description: getErrorMessage(err) });
    }
  };

  const pendingId = updateUser.isPending ? updateUser.variables?.id : undefined;

  return (
    <PageWrapper maxW="container.xl">
      <Stack spacing={8}>
        <AdminHeader title="Users" subtitle="Activate, deactivate or promote accounts." />

        <InputGroup maxW="sm">
          <InputLeftElement pointerEvents="none">
            <FiSearch aria-hidden="true" />
          </InputLeftElement>
          <Input
            placeholder="Search by email or name"
            aria-label="Search users"
            value={searchInput}
            maxLength={100}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </InputGroup>

        {query.isLoading ? (
          <Skeleton h="320px" borderRadius="2xl" aria-busy="true" aria-label="Loading users" />
        ) : query.isError ? (
          <QueryErrorCard error={query.error} onRetry={() => void query.refetch()} />
        ) : items.length === 0 ? (
          <GlassCard disableHover textAlign="center" py={10}>
            <Text color="text.muted">No users match &ldquo;{search}&rdquo;.</Text>
          </GlassCard>
        ) : (
          <GlassCard disableHover p={0} overflow="hidden">
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>User</Th>
                    <Th isNumeric>Roasts</Th>
                    <Th>Joined</Th>
                    <Th>Active</Th>
                    <Th>Admin</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    const isBusy = pendingId === u.id;
                    return (
                      <Tr key={u.id}>
                        <Td>
                          <Stack spacing={0}>
                            <HStack spacing={2}>
                              <Text fontWeight="medium">{u.full_name || '—'}</Text>
                              {isSelf && <Badge colorScheme="purple">You</Badge>}
                              {u.oauth_provider && <Badge variant="outline">{u.oauth_provider}</Badge>}
                            </HStack>
                            <Text fontSize="sm" color="text.muted">
                              {u.email}
                            </Text>
                          </Stack>
                        </Td>
                        <Td isNumeric>{u.submission_count}</Td>
                        <Td>
                          <Text fontSize="sm" color="text.muted">
                            {formatRelativeDate(u.created_at)}
                          </Text>
                        </Td>
                        <Td>
                          <Switch
                            aria-label={`Active: ${u.email}`}
                            isChecked={u.is_active}
                            isDisabled={isSelf || isBusy}
                            onChange={(e) => void handleToggle(u, { is_active: e.target.checked })}
                          />
                        </Td>
                        <Td>
                          <Switch
                            aria-label={`Admin: ${u.email}`}
                            colorScheme="purple"
                            isChecked={u.is_admin}
                            isDisabled={isSelf || isBusy}
                            onChange={(e) => void handleToggle(u, { is_admin: e.target.checked })}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </GlassCard>
        )}

        <PaginationNav page={page} totalPages={totalPages} isFetching={query.isFetching} onChange={goToPage} />
      </Stack>
    </PageWrapper>
  );
}

export default AdminUsersPage;
