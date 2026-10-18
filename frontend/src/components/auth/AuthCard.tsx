import type { ReactNode } from 'react';
import { Box, Heading, Stack, Text } from '@chakra-ui/react';
import { SectionCard } from '../ui/SectionCard';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card used by the login / register / forgot-password pages. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <SectionCard maxW="md" mx="auto" p={{ base: 6, md: 8 }}>
      <Stack spacing={6}>
        <Stack spacing={2} textAlign="center">
          <Heading as="h1" size="lg">
            {title}
          </Heading>
          {subtitle && <Text color="text.muted">{subtitle}</Text>}
        </Stack>
        {children}
        {footer && (
          <Box fontSize="sm" color="text.muted" textAlign="center">
            {footer}
          </Box>
        )}
      </Stack>
    </SectionCard>
  );
}

export default AuthCard;
