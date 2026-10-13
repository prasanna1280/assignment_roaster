import { Box, Text, VStack, useToken } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { formatScore, scoreColorToken, toScore } from './roastUtils';

export interface ScoreRingProps {
  /** Score from 0 to 10. */
  score: number | string;
  /** Diameter in pixels. */
  size?: number;
  /** Ring thickness in pixels. */
  thickness?: number;
  label?: string;
}

/** Animated circular score (0–10), coloured by how well the repo did. */
export function ScoreRing({ score, size = 160, thickness = 12, label = 'Overall score' }: ScoreRingProps) {
  const value = toScore(score);
  const colorToken = scoreColorToken(value);
  const [strokeColor, trackColor] = useToken('colors', [colorToken, 'whiteAlpha.200']);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 10);
  const display = formatScore(value);
  const center = size / 2;

  return (
    <Box
      position="relative"
      w={`${size}px`}
      h={`${size}px`}
      flexShrink={0}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={value}
      aria-valuetext={`${display} out of 10`}
      data-testid="score-ring"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <VStack position="absolute" inset={0} justify="center" spacing={0}>
        <Text
          fontSize={size >= 120 ? '4xl' : 'xl'}
          fontWeight="bold"
          fontFamily="heading"
          lineHeight="1"
          color={colorToken}
        >
          {display}
        </Text>
        <Text fontSize="xs" color="text.muted">
          / 10
        </Text>
      </VStack>
    </Box>
  );
}

export default ScoreRing;
