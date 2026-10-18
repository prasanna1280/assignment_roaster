import { Link as RouterLink } from 'react-router-dom';
import { Badge, Box, Button, Divider, Flex, Heading, HStack, Icon, List, ListIcon, ListItem, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { FiCheck, FiCpu, FiEyeOff, FiGithub, FiLock, FiTarget, FiZap } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { PageWrapper } from '../components/ui/PageWrapper';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { SectionCard } from '../components/ui/SectionCard';
import { ScoreRing } from '../components/roast/ScoreRing';
import { CategoryBars } from '../components/roast/CategoryBars';
import { ROAST_LANGUAGES, ROAST_LEVELS } from '../lib/roastModes';
import type { CategoryScores } from '../types';

interface Feature {
  icon: IconType;
  title: string;
  description: string;
}

const STEPS: Feature[] = [
  {
    icon: FiGithub,
    title: 'Paste a public repo',
    description: 'Drop in a GitHub link, plus the assignment brief if you have one. No GitHub login needed.',
  },
  {
    icon: FiZap,
    title: 'Pick your roast',
    description: 'Choose how spicy the feedback is and whether it reads in English, Tamil or Tanglish.',
  },
  {
    icon: FiTarget,
    title: 'Fix what matters',
    description: 'Get a score out of 10, six category scores and file-level fixes ranked by severity.',
  },
];

const TRUST_POINTS: Feature[] = [
  {
    icon: FiLock,
    title: 'Secrets are masked',
    description: 'API keys, passwords and .env values are redacted before any code reaches the AI.',
  },
  {
    icon: FiEyeOff,
    title: 'Code is never run',
    description: 'Repos are read as plain text. Nothing is installed, built or executed.',
  },
  {
    icon: FiCpu,
    title: 'Fair, consistent scoring',
    description: 'The roast level only changes the tone. Every roast is scored on the same six-category rubric.',
  },
];

const SAMPLE_SCORES: CategoryScores = {
  code_quality: 7.5,
  structure: 8,
  readability: 7,
  documentation: 4.5,
  testing: 3,
  best_practices: 6.5,
};

function SampleReport() {
  return (
    <SectionCard p={0} overflow="hidden" aria-label="Sample roast report">
      <Flex px={5} py={3} borderBottomWidth="1px" borderColor="border.subtle" bg="bg.subtle" justify="space-between" align="center">
        <Text fontFamily="mono" fontSize="sm" color="text.muted">
          student/todo-api
        </Text>
        <Badge variant="outline" colorScheme="gray">
          Medium · English
        </Badge>
      </Flex>
      <Stack p={5} spacing={5}>
        <HStack spacing={5} align="center">
          <ScoreRing score={6.4} size={96} thickness={8} label="Sample overall score" />
          <Box borderLeftWidth="3px" borderColor="accent.solid" pl={4}>
            <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" color="text.muted">
              Verdict
            </Text>
            <Text fontWeight="semibold" mt={1}>
              Solid API, but your tests folder is just a very tidy empty room.
            </Text>
          </Box>
        </HStack>
        <CategoryBars scores={SAMPLE_SCORES} />
      </Stack>
    </SectionCard>
  );
}

export function HomePage() {
  return (
    <PageWrapper maxW="container.xl">
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 10, lg: 16 }} alignItems="center" pt={{ base: 2, md: 8 }} pb={{ base: 12, md: 20 }}>
        <Stack spacing={6}>
          <Text fontSize="sm" fontWeight="semibold" letterSpacing="wider" textTransform="uppercase" color="accent.fg">
            AI code review for student projects
          </Text>
          <Heading as="h1" fontSize={{ base: '4xl', md: '5xl' }} lineHeight="1.1">
            Honest code reviews that students actually read.
          </Heading>
          <Text fontSize={{ base: 'md', md: 'lg' }} color="text.muted" maxW="xl">
            Submit a GitHub repo and get a scored review with a sense of humour: what works, what doesn&apos;t, and the
            exact files to fix first. In English, Tamil or Tanglish.
          </Text>
          <List spacing={2} color="text.muted">
            {['Score out of 10 across six categories', 'File-level fixes ranked by severity', 'Checks the work against the assignment brief'].map(
              (point) => (
                <ListItem key={point} display="flex" alignItems="center">
                  <ListIcon as={FiCheck} color="accent.fg" />
                  {point}
                </ListItem>
              ),
            )}
          </List>
          <HStack spacing={3} pt={2} flexWrap="wrap">
            <PrimaryButton to="/roast/new" size="lg">
              Roast my repo
            </PrimaryButton>
            <Button as="a" href="#how-it-works" size="lg" variant="outline" colorScheme="gray">
              How it works
            </Button>
          </HStack>
        </Stack>
        <SampleReport />
      </SimpleGrid>

      <Stack as="section" id="how-it-works" spacing={8} py={{ base: 8, md: 12 }} aria-labelledby="how-heading">
        <Stack spacing={2}>
          <Heading as="h2" id="how-heading" size="lg">
            How it works
          </Heading>
          <Text color="text.muted">From repo link to a prioritised fix list in about a minute.</Text>
        </Stack>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          {STEPS.map((step, i) => (
            <SectionCard key={step.title}>
              <HStack spacing={3} mb={3}>
                <Text fontSize="sm" fontWeight="semibold" color="text.muted">
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Icon as={step.icon} boxSize={5} color="accent.fg" aria-hidden="true" />
              </HStack>
              <Heading as="h3" size="sm" mb={2}>
                {step.title}
              </Heading>
              <Text color="text.muted" fontSize="sm">
                {step.description}
              </Text>
            </SectionCard>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack as="section" spacing={8} py={{ base: 8, md: 12 }} aria-labelledby="modes-heading">
        <Stack spacing={2}>
          <Heading as="h2" id="modes-heading" size="lg">
            Choose your roast
          </Heading>
          <Text color="text.muted">Every level is scored on the same rubric. You choose the tone and the language.</Text>
        </Stack>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <SectionCard>
            <Heading as="h3" size="sm" mb={4}>
              Roast level
            </Heading>
            <Stack divider={<Divider />} spacing={3}>
              {ROAST_LEVELS.map((level) => (
                <Flex key={level.value} justify="space-between" gap={4}>
                  <Text fontWeight="medium">{level.label}</Text>
                  <Text color="text.muted" fontSize="sm" textAlign="right">
                    {level.description}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </SectionCard>
          <SectionCard>
            <Heading as="h3" size="sm" mb={4}>
              Language
            </Heading>
            <Stack divider={<Divider />} spacing={3}>
              {ROAST_LANGUAGES.map((language) => (
                <Flex key={language.value} justify="space-between" gap={4}>
                  <Text fontWeight="medium">{language.label}</Text>
                  <Text color="text.muted" fontSize="sm" textAlign="right">
                    {language.description}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </SectionCard>
        </SimpleGrid>
      </Stack>

      <Stack as="section" spacing={8} py={{ base: 8, md: 12 }} aria-labelledby="trust-heading">
        <Heading as="h2" id="trust-heading" size="lg">
          Built to be safe with student code
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
          {TRUST_POINTS.map((point) => (
            <Stack key={point.title} spacing={2}>
              <Icon as={point.icon} boxSize={5} color="accent.fg" aria-hidden="true" />
              <Heading as="h3" size="sm">
                {point.title}
              </Heading>
              <Text color="text.muted" fontSize="sm">
                {point.description}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>

      <SectionCard bg="bg.subtle" boxShadow="none" mt={{ base: 8, md: 12 }} p={{ base: 6, md: 10 }}>
        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ md: 'center' }} gap={6}>
          <Stack spacing={1}>
            <Heading as="h2" size="md">
              Ready for an honest review?
            </Heading>
            <Text color="text.muted">Free daily roasts. Public GitHub repos only.</Text>
          </Stack>
          <HStack spacing={3}>
            <PrimaryButton to="/register">Create free account</PrimaryButton>
            <Button as={RouterLink} to="/login" variant="ghost" colorScheme="gray">
              Log in
            </Button>
          </HStack>
        </Flex>
      </SectionCard>
    </PageWrapper>
  );
}

export default HomePage;
