import { Badge } from '@chakra-ui/react';
import type { SubmissionStatus } from '../../types';
import { STATUS_COLOR_SCHEMES, STATUS_LABELS } from './roastUtils';

export interface StatusBadgeProps {
  status: SubmissionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge colorScheme={STATUS_COLOR_SCHEMES[status]} borderRadius="full" px={2.5} py={0.5}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export default StatusBadge;
