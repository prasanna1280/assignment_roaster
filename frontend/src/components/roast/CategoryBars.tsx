import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import type { CategoryScores } from '../../types';
import { MotionBox } from '../../lib/motion';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatScore, scoreColorToken, toScore } from './roastUtils';

export interface CategoryBarsProps {
  scores: CategoryScores;
}

/** Six labelled, animated 0–10 bars for the roast categories. */
export function CategoryBars({ scores }: CategoryBarsProps) {
  return (
    <Stack spacing={4} as="ul" listStyleType="none" aria-label="Category scores">
      {CATEGORY_ORDER.map((key, i) => {
        const value = toScore(scores[key]);
        const label = CATEGORY_LABELS[key];
        return (
          <Box as="li" key={key}>
            <Flex justify="space-between" mb={1.5}>
              <Text fontWeight="medium">{label}</Text>
              <Text fontWeight="semibold" color={scoreColorToken(value)} data-testid={`category-${key}`}>
                {formatScore(value)}
                <Text as="span" color="text.muted" fontWeight="normal">
                  {' / 10'}
                </Text>
              </Text>
            </Flex>
            <Box
              h={2}
              bg="bg.subtle"
              borderRadius="sm"
              overflow="hidden"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={value}
            >
              <MotionBox
                h="full"
                borderRadius="sm"
                bg={scoreColorToken(value)}
                initial={{ width: '0%' }}
                animate={{ width: `${value * 10}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export default CategoryBars;
