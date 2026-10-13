import { Heading, Stack, Text } from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';

export function NotFoundPage() {
  return (
    <PageWrapper maxW="container.md">
      <Stack spacing={5} align="center" textAlign="center" py={20}>
        <Heading as="h1" fontSize={{ base: '5xl', md: '7xl' }} color="accent.fg">
          404
        </Heading>
        <Heading as="h2" size="lg">
          Indha page-ah kaanom!
        </Heading>
        <Text color="text.muted">The page you are looking for does not exist (or got roasted away).</Text>
        <GradientButton to="/">
          Go home
        </GradientButton>
      </Stack>
    </PageWrapper>
  );
}

export default NotFoundPage;
