import type { ReactNode } from 'react';
import { Container, type ContainerProps } from '@chakra-ui/react';
import { MotionBox } from '../../lib/motion';

export interface PageWrapperProps {
  children: ReactNode;
  /** Max width of the inner container (Chakra size token). */
  maxW?: ContainerProps['maxW'];
}

export function PageWrapper({ children, maxW = 'container.lg' }: PageWrapperProps) {
  return (
    <MotionBox
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      minH="calc(100vh - 64px)"
      py={{ base: 8, md: 12 }}
    >
      <Container maxW={maxW} px={{ base: 4, md: 6 }}>
        {children}
      </Container>
    </MotionBox>
  );
}

export default PageWrapper;
