import { useEffect, useState } from 'react';
import { Box, Circle, Flex, HStack, Icon, Stack, Text, VisuallyHidden } from '@chakra-ui/react';
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
  { key: 'queued', label: 'Queued', description: 'Line la nikkudhu' },
  { key: 'fetching', label: 'Fetching', description: 'Repo-va download panrom' },
  { key: 'analyzing', label: 'Analyzing', description: 'AI roast cook aagudhu' },
  { key: 'done', label: 'Done', description: 'Roast ready!' },
];

const ROAST_TAGLINES: string[] = [
  'Un code-ah padichitu irukken…',
  'Roast ready aagudhu, wait pannu machaan 🔥',
  'console.log ellam count pannittu irukken 👀',
  'Variable names paathu konjam shock aayiten…',
  'README-la enna irukku nu paakren…',
  'Tests irukka illaya? Theditu irukken 🔍',
  'Masala add panrom, konjam spicy-ah varum 🌶️',
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

/** Animated queued → fetching → analyzing → done progress with rotating Tanglish taglines. */
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
        <Box position="absolute" top="20px" left="12.5%" right="12.5%" h="2px" bg="whiteAlpha.200" aria-hidden="true">
          <MotionBox
            h="full"
            bgGradient="linear(to-r, brand.400, ember.500)"
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
              <MotionBox
                animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={isActive ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              >
                <Circle
                  size="40px"
                  bg={isDone ? 'brand.500' : isActive ? 'bg.surface' : 'bg.canvas'}
                  borderWidth="2px"
                  borderColor={isDone || isActive ? 'brand.400' : 'whiteAlpha.300'}
                  color={isDone ? 'white' : isActive ? 'accent.fg' : 'text.muted'}
                  boxShadow={isActive ? 'glow' : 'none'}
                  fontWeight="bold"
                >
                  {isDone ? <Icon as={FiCheck} aria-hidden="true" /> : i + 1}
                </Circle>
              </MotionBox>
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
            <Text fontSize={{ base: 'md', md: 'lg' }} color="accent.fg" fontWeight="medium" textAlign="center">
              {ROAST_TAGLINES[taglineIndex]}
            </Text>
          </MotionBox>
        </AnimatePresence>
      </HStack>
    </Stack>
  );
}

export default StatusStepper;
