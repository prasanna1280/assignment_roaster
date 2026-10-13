import { Button, HStack, Text } from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export interface PaginationNavProps {
  page: number;
  totalPages: number;
  isFetching: boolean;
  onChange: (page: number) => void;
}

/** Previous / "Page x of y" / Next. Renders nothing for a single page. */
export function PaginationNav({ page, totalPages, isFetching, onChange }: PaginationNavProps) {
  if (totalPages <= 1) return null;
  return (
    <HStack as="nav" aria-label="Pagination" justify="center" spacing={4}>
      <Button
        leftIcon={<FiChevronLeft aria-hidden="true" />}
        variant="outline"
        onClick={() => onChange(page - 1)}
        isDisabled={page <= 1 || isFetching}
      >
        Previous
      </Button>
      <Text color="text.muted" aria-live="polite">
        Page {page} of {totalPages}
      </Text>
      <Button
        rightIcon={<FiChevronRight aria-hidden="true" />}
        variant="outline"
        onClick={() => onChange(page + 1)}
        isDisabled={page >= totalPages || isFetching}
      >
        Next
      </Button>
    </HStack>
  );
}

export default PaginationNav;
