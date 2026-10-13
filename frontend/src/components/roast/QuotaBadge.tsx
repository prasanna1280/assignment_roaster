import { HStack, Icon, Skeleton, Tag, TagLabel, Tooltip } from '@chakra-ui/react';
import { FaFire } from 'react-icons/fa';
import type { Quota } from '../../types';

export interface QuotaBadgeProps {
  quota: Quota | undefined;
  isLoading?: boolean;
}

function formatResetTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'tomorrow';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Shows how many roasts are left today. */
export function QuotaBadge({ quota, isLoading = false }: QuotaBadgeProps) {
  if (isLoading) return <Skeleton h="28px" w="160px" borderRadius="full" />;
  if (!quota) return null;

  const remaining = Math.max(0, quota.limit - quota.used);
  const exhausted = remaining === 0;
  const resetsAt = formatResetTime(quota.resets_at);
  const colorScheme = exhausted ? 'red' : remaining === 1 ? 'orange' : 'green';

  return (
    <Tooltip label={`Daily quota resets at ${resetsAt}`} hasArrow>
      <Tag size="lg" borderRadius="full" variant="subtle" colorScheme={colorScheme} tabIndex={0} data-testid="quota-badge">
        <HStack spacing={2}>
          <Icon as={FaFire} aria-hidden="true" />
          <TagLabel>
            {exhausted
              ? `Daily limit reached · resets ${resetsAt}`
              : `${remaining} of ${quota.limit} roasts left today`}
          </TagLabel>
        </HStack>
      </Tag>
    </Tooltip>
  );
}

export default QuotaBadge;
