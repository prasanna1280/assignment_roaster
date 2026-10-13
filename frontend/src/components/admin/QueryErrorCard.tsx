import { Button, Stack, Text } from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { GlassCard } from '../ui/GlassCard';
import { getErrorMessage } from '../../services/api';

export interface QueryErrorCardProps {
  error: unknown;
  onRetry: () => void;
}

/** Error message with a "Try again" button for a failed query. */
export function QueryErrorCard({ error, onRetry }: QueryErrorCardProps) {
  return (
    <GlassCard disableHover role="alert">
      <Stack spacing={4} align="flex-start">
        <Text>{getErrorMessage(error)}</Text>
        <Button leftIcon={<FiRefreshCw aria-hidden="true" />} onClick={onRetry}>
          Try again
        </Button>
      </Stack>
    </GlassCard>
  );
}

export default QueryErrorCard;
