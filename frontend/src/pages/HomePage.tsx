import { Box, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { FiGithub, FiTarget, FiZap } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { PageWrapper } from '../components/ui/PageWrapper';
import { GradientButton } from '../components/ui/GradientButton';
import { GlassCard } from '../components/ui/GlassCard';

interface Feature {
  icon: IconType;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: FiGithub,
    title: 'Paste a public repo',
    description: 'Drop your GitHub link. No GitHub login, no fuss.',
  },
  {
    icon: FiZap,
    title: 'Get roasted (kindly)',
    description: 'Honest Tanglish feedback, a score out of 10, and zero mercy for console.log.',
  },
  {
    icon: FiTarget,
    title: 'Fix what matters',
    description: 'Actionable fixes ranked by severity, so you know what to improve first.',
  },
];

export function HomePage() {
  return (
    <PageWrapper maxW="container.lg">
      <Stack spacing={6} align="center" textAlign="center" pt={{ base: 6, md: 16 }} pb={12}>
        <Text
          fontSize="sm"
          fontWeight="semibold"
          letterSpacing="wider"
          textTransform="uppercase"
          color="accent.fg"
        >
          AI code review for students
        </Text>
        <Heading
          as="h1"
          fontSize={{ base: '4xl', md: '6xl' }}
          lineHeight="1.1"
          bgGradient="linear(to-r, brand.300, ember.400)"
          bgClip="text"
        >
          Un code-ah roast panna ready ah?
        </Heading>
        <Text fontSize={{ base: 'md', md: 'xl' }} color="text.muted" maxW="2xl">
          Submit your assignment repo and get a friendly, brutally honest roast with a score and
          real fixes. Semma feedback, no drama.
        </Text>
        <GradientButton to="/roast/new" size="lg">
          🔥 Roast my repo
        </GradientButton>
      </Stack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        {FEATURES.map((feature) => (
          <GlassCard key={feature.title}>
            <Box as={feature.icon} boxSize={7} color="accent.fg" mb={3} />
            <Heading as="h3" size="md" mb={2}>
              {feature.title}
            </Heading>
            <Text color="text.muted">{feature.description}</Text>
          </GlassCard>
        ))}
      </SimpleGrid>

      <Text mt={12} fontSize="sm" color="text.muted" textAlign="center">
        Public repos only. Secrets are masked before anything reaches the AI.
      </Text>
    </PageWrapper>
  );
}

export default HomePage;
