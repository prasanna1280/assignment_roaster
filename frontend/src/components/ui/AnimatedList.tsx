import { Children, type ReactNode } from 'react';
import type { Variants } from 'framer-motion';
import type { StackProps } from '@chakra-ui/react';
import { MotionBox } from '../../lib/motion';

export interface AnimatedListProps {
  children: ReactNode;
  /** Vertical gap between items (Chakra spacing token). */
  spacing?: StackProps['spacing'];
  /** Delay between each item's entrance, in seconds. */
  stagger?: number;
}

const containerVariants = (stagger: number): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger } },
});

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export function AnimatedList({ children, spacing = 4, stagger = 0.08 }: AnimatedListProps) {
  const items = Children.toArray(children);
  return (
    <MotionBox
      initial="hidden"
      animate="visible"
      variants={containerVariants(stagger)}
      display="flex"
      flexDirection="column"
      gap={spacing}
    >
      {items.map((child, i) => (
        <MotionBox key={i} variants={itemVariants}>
          {child}
        </MotionBox>
      ))}
    </MotionBox>
  );
}

export default AnimatedList;
