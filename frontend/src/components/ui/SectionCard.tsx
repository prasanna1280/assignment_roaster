import type { ReactNode } from 'react';
import { Box, type BoxProps } from '@chakra-ui/react';
import { avoidPrintBreak } from '../../lib/print';

export interface SectionCardProps extends BoxProps {
  children: ReactNode;
  /** Adds a hover state for cards that act as links. */
  interactive?: boolean;
}

/** Flat, bordered surface used for every content block. */
export function SectionCard({ children, interactive = false, ...rest }: SectionCardProps) {
  return (
    <Box
      p={6}
      borderRadius="lg"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="card"
      transition="border-color 0.15s, box-shadow 0.15s"
      _hover={interactive ? { borderColor: 'border.strong', boxShadow: 'cardHover' } : undefined}
      sx={avoidPrintBreak}
      {...rest}
    >
      {children}
    </Box>
  );
}

export default SectionCard;
