import { useEffect, useState } from 'react';
import { Box, Circle, Flex, HStack, Icon, Spinner, Stack, Text, VisuallyHidden } from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';
import { FiCheck } from 'react-icons/fi';
import type { SubmissionStatus } from '../../types';
import { MotionBox } from '../../lib/motion';

interface Step {
  key: 'queued' | 'fetching' | 'analyzing' | 'done';
  label: string;
  description: string;
}

const STEPS: Step[] = [
  { key: 'queued', label: 'Queued', description: 'Waiting for a worker' },
  { key: 'fetching', label: 'Fetching', description: 'Downloading the repo' },
  { key: 'analyzing', label: 'Analyzing', description: 'Reviewing the code' },
  { key: 'done', label: 'Done', description: 'Report ready' },
];

const ROAST_TAGLINES: string[] = [
  'Reading through your code…',
  'Checking project structure and naming…',
  'Counting the console.log statements…',
  'Looking for tests and how much they cover…',
  'Reading the README and setup steps…',
  'Scanning for hardcoded secrets…',
  'Writing up the fixes, most important first…',
];

const TAGLINE_INTERVAL_MS = 3000;

function stepIndex(status: SubmissionStatus): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'fetching':
      return 1;
    case 'analyzing':
      return 2;
    default:
      return 3;
  }
}

export interface StatusStepperProps {
  status: SubmissionStatus;
}

/** Queued → fetching → analyzing → done progress with rotating status lines. */
export function StatusStepper({ status }: StatusStepperProps) {
  const current = stepIndex(status);
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTaglineIndex((i) => (i + 1) % ROAST_TAGLINES.length);
    }, TAGLINE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Stack spacing={8} align="center" w="full">
      <VisuallyHidden role="status" aria-live="polite">
        {`Roast status: ${STEPS[current]?.label ?? status}`}
      </VisuallyHidden>

      <Flex as="ol" w="full" maxW="2xl" justify="space-between" position="relative" listStyleType="none">
        <Box position="absolute" top="20px" left="12.5%" right="12.5%" h="2px" bg="border.subtle" aria-hidden="true">
          <MotionBox
            h="full"
            bg="accent.solid"
            initial={{ width: '0%' }}
            animate={{ width: `${(current / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </Box>
        {STEPS.map((step, i) => {
          const isDone = i < current || (i === current && step.key === 'done');
          const isActive = i === current && step.key !== 'done';
          return (
            <Stack
              as="li"
              key={step.key}
              flex="1"
              align="center"
              spacing={2}
              zIndex={1}
              aria-current={isActive ? 'step' : undefined}
            >
              <Circle
                size="40px"
                bg={isDone ? 'accent.solid' : 'bg.surface'}
                borderWidth="2px"
                borderColor={isDone || isActive ? 'accent.solid' : 'border.strong'}
                color={isDone ? 'bg.surface' : isActive ? 'accent.fg' : 'text.muted'}
                fontWeight="semibold"
              >
                {isDone ? <Icon as={FiCheck} aria-hidden="true" /> : isActive ? <Spinner size="sm" /> : i + 1}
              </Circle>
              <Text fontWeight="semibold" fontSize="sm" color={isDone || isActive ? 'text.primary' : 'text.muted'}>
                {step.label}
              </Text>
              <Text fontSize="xs" color="text.muted" textAlign="center" display={{ base: 'none', sm: 'block' }}>
                {step.description}
              </Text>
            </Stack>
          );
        })}
      </Flex>

      <HStack minH="32px" justify="center" aria-hidden="true">
        <AnimatePresence mode="wait">
          <MotionBox
            key={taglineIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <Text fontSize="md" color="text.muted" textAlign="center">
              {ROAST_TAGLINES[taglineIndex]}
            </Text>
          </MotionBox>
        </AnimatePresence>
      </HStack>
    </Stack>
  );
}

export default StatusStepper;
