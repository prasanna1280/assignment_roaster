import { Button, Heading, HStack, Icon, Stack, Text } from '@chakra-ui/react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { getErrorTip } from './errorTips';

export interface SubmissionErrorStateProps {
  errorCode: string | null;
  errorMessage: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function SubmissionErrorState({ errorCode, errorMessage, onRetry, isRetrying = false }: SubmissionErrorStateProps) {
  const { tip, retryable } = getErrorTip(errorCode);
  return (
    <GlassCard disableHover borderColor="severity.high" role="alert">
      <Stack spacing={4} align="flex-start">
        <HStack spacing={3}>
          <Icon as={FiAlertTriangle} boxSize={7} color="severity.high" aria-hidden="true" />
          <Heading as="h2" size="md">
            Aiyo, roast fail aayiduchu!
          </Heading>
        </HStack>
        <Text fontSize="lg">{errorMessage ?? 'Something went wrong while roasting this repo.'}</Text>
        <Text color="text.muted" data-testid="error-tip">
          <Text as="span" fontWeight="semibold" color="accent.fg">
            {'Tip: '}
          </Text>
          {tip}
        </Text>
        <HStack spacing={3} pt={2} flexWrap="wrap">
          {onRetry && retryable && (
            <Button
              leftIcon={<FiRefreshCw aria-hidden="true" />}
              variant="outline"
              onClick={onRetry}
              isLoading={isRetrying}
              loadingText="Retrying"
            >
              Try again
            </Button>
          )}
          <GradientButton to="/roast/new">Roast another repo</GradientButton>
        </HStack>
      </Stack>
    </GlassCard>
  );
}

export default SubmissionErrorState;
