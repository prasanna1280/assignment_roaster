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
import { GlassCard } from '../components/ui/GlassCard';
import { useAuth } from '../hooks/useAuth';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <PageWrapper maxW="container.md">
      <Stack spacing={8}>
        <Stack spacing={1}>
          <Heading as="h1" size="xl">
            Settings
          </Heading>
          <Text color="text.muted">Un account, un rules.</Text>
        </Stack>

        <GlassCard disableHover>
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
                    <Badge colorScheme={user.is_verified ? 'green' : 'orange'} borderRadius="full" px={2}>
                      {user.is_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                    <Badge borderRadius="full" px={2}>
                      {user.oauth_provider ? `Signed in with ${user.oauth_provider}` : 'Email & password'}
                    </Badge>
                  </HStack>
                </Stack>
              </HStack>
            ) : (
              <Text color="text.muted">Account details load aagala.</Text>
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
        </GlassCard>

        <GlassCard disableHover>
          <Stack spacing={4}>
            <HStack spacing={2}>
              <Icon as={FiSliders} color="accent.fg" aria-hidden="true" />
              <Heading as="h2" size="md">
                Roast preferences
              </Heading>
              <Badge colorScheme="orange" borderRadius="full" px={2}>
                Coming soon
              </Badge>
            </HStack>
            <Text color="text.muted">
              Tone selector coming soon — mild, medium or full-spicy roasts. For now, every roast is friendly and
              honest Tanglish. 🌶️
            </Text>
          </Stack>
        </GlassCard>

        <GlassCard disableHover>
          <HStack spacing={3} align="flex-start">
            <Icon as={FiGithub} boxSize={5} color="text.muted" mt={0.5} aria-hidden="true" />
            <Text color="text.muted" fontSize="sm">
              Public repos only — no GitHub connection needed. Secrets are masked before anything reaches the AI.
            </Text>
          </HStack>
        </GlassCard>
      </Stack>
    </PageWrapper>
  );
}

export default SettingsPage;
