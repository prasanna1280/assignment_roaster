import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Heading,
  HStack,
  Icon,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { FiGithub, FiSliders, FiUser } from 'react-icons/fi';
import { PageWrapper } from '../components/ui/PageWrapper';
import { SectionCard } from '../components/ui/SectionCard';
import { RoastModePicker } from '../components/roast/RoastModePicker';
import { useAuth } from '../hooks/useAuth';
import { loadRoastModePreference, saveRoastModePreference, type RoastModePreference } from '../lib/roastModes';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

export function SettingsPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<RoastModePreference>(loadRoastModePreference);

  const updateMode = (next: RoastModePreference) => {
    setMode(next);
    saveRoastModePreference(next);
  };

  return (
    <PageWrapper maxW="container.md">
      <Stack spacing={8}>
        <Stack spacing={1}>
          <Heading as="h1" size="xl">
            Settings
          </Heading>
          <Text color="text.muted">Your account and roast defaults.</Text>
        </Stack>

        <SectionCard>
          <Stack spacing={5}>
            <HStack spacing={2}>
              <Icon as={FiUser} color="accent.fg" aria-hidden="true" />
              <Heading as="h2" size="md">
                Account
              </Heading>
            </HStack>
            {user ? (
              <HStack spacing={4} align="center">
                <Avatar name={user.full_name} src={user.avatar_url ?? undefined} size="lg" />
                <Stack spacing={1} minW={0}>
                  <Text fontWeight="semibold" fontSize="lg" noOfLines={1}>
                    {user.full_name}
                  </Text>
                  <Text color="text.muted" noOfLines={1}>
                    {user.email}
                  </Text>
                  <HStack spacing={2} flexWrap="wrap">
                    <Badge colorScheme={user.is_verified ? 'green' : 'orange'} px={2}>
                      {user.is_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                    <Badge px={2}>
                      {user.oauth_provider ? `Signed in with ${user.oauth_provider}` : 'Email & password'}
                    </Badge>
                  </HStack>
                </Stack>
              </HStack>
            ) : (
              <Text color="text.muted">Could not load account details.</Text>
            )}
            <Divider borderColor="border.subtle" />
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} alignItems="center">
              <Text color="text.muted" fontSize="sm">
                {user ? `Member since ${formatDate(user.created_at)}` : ''}
              </Text>
              <Button as={RouterLink} to="/profile" variant="outline" justifySelf={{ sm: 'end' }}>
                Edit profile
              </Button>
            </SimpleGrid>
          </Stack>
        </SectionCard>

        <SectionCard>
          <Stack spacing={4}>
            <HStack spacing={2}>
              <Icon as={FiSliders} color="accent.fg" aria-hidden="true" />
              <Heading as="h2" size="md">
                Default roast mode
              </Heading>
            </HStack>
            <Text color="text.muted" fontSize="sm">
              Pre-selected on every new roast on this device. You can still change it per roast.
            </Text>
            <RoastModePicker
              level={mode.level}
              language={mode.language}
              onLevelChange={(level) => updateMode({ ...mode, level })}
              onLanguageChange={(language) => updateMode({ ...mode, language })}
            />
          </Stack>
        </SectionCard>

        <SectionCard>
          <HStack spacing={3} align="flex-start">
            <Icon as={FiGithub} boxSize={5} color="text.muted" mt={0.5} aria-hidden="true" />
            <Text color="text.muted" fontSize="sm">
              Public repos only — no GitHub connection needed. Secrets are masked before anything reaches the AI.
            </Text>
          </HStack>
        </SectionCard>
      </Stack>
    </PageWrapper>
  );
}

export default SettingsPage;
