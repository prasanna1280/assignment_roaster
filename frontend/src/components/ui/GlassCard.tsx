import type { ReactNode } from 'react';
import type { BoxProps } from '@chakra-ui/react';
import { MotionBox } from '../../lib/motion';

export interface GlassCardProps
  extends Omit<
    BoxProps,
    'transition' | 'onAnimationStart' | 'onAnimationEnd' | 'onDrag' | 'onDragStart' | 'onDragEnd'
  > {
  children: ReactNode;
  /** Disable the hover lift (e.g. for large static containers). */
  disableHover?: boolean;
}

export function GlassCard({ children, disableHover = false, ...rest }: GlassCardProps) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={disableHover ? undefined : { scale: 1.02, y: -5 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      p={6}
      borderRadius="2xl"
      bg="bg.glass"
      backdropFilter="blur(16px)"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="xl"
      _hover={disableHover ? undefined : { boxShadow: 'glow' }}
      {...rest}
    >
      {children}
    </MotionBox>
  );
}

export default GlassCard;
