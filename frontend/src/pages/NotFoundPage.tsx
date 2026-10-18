import { Heading, Stack, Text } from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PrimaryButton } from '../components/ui/PrimaryButton';

export function NotFoundPage() {
  return (
    <PageWrapper maxW="container.md">
      <Stack spacing={5} align="center" textAlign="center" py={20}>
        <Heading as="h1" fontSize={{ base: '5xl', md: '7xl' }} color="accent.fg">
          404
        </Heading>
        <Heading as="h2" size="lg">
          Page not found
        </Heading>
        <Text color="text.muted">The page you are looking for does not exist (or got roasted away).</Text>
        <PrimaryButton to="/">
          Go home
        </PrimaryButton>
      </Stack>
    </PageWrapper>
  );
}

export default NotFoundPage;
