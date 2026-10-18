import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Avatar,
  Badge,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { SectionCard } from '../components/ui/SectionCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { validateAvatarUrl, validateFullName } from '../components/auth/validation';
import { useAuth } from '../hooks/useAuth';
import { getAuthErrorMessage } from '../services/authService';
import type { UpdateProfileRequest } from '../types';

interface ProfileErrors {
  fullName?: string;
  avatarUrl?: string;
}

function providerLabel(provider: string | null): string {
  if (!provider) return 'Email';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name ?? '');
    setAvatarUrl(user?.avatar_url ?? '');
  }, [user?.full_name, user?.avatar_url]);

  if (!user) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    const nextErrors: ProfileErrors = {
      fullName: validateFullName(fullName),
      avatarUrl: validateAvatarUrl(avatarUrl),
    };
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.avatarUrl) return;

    const payload: UpdateProfileRequest = { full_name: fullName.trim() };
    if (avatarUrl.trim()) payload.avatar_url = avatarUrl.trim();

    setIsSaving(true);
    try {
      await updateProfile(payload);
      toast({ status: 'success', title: 'Profile updated', duration: 3000, isClosable: true });
    } catch (err) {
      setServerError(getAuthErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const joined = new Date(user.created_at);

  return (
    <PageWrapper maxW="container.md">
      <Stack spacing={6}>
        <Heading as="h1" size="xl">
          Un profile
        </Heading>

        <SectionCard>
          <HStack spacing={5} align="center" flexWrap="wrap">
            <Avatar size="xl" name={user.full_name} src={user.avatar_url ?? undefined} />
            <Stack spacing={1} minW={0}>
              <Heading as="h2" size="md">
                {user.full_name}
              </Heading>
              <Text color="text.muted" wordBreak="break-all">
                {user.email}
              </Text>
              <HStack spacing={2} flexWrap="wrap">
                <Badge colorScheme="brand" px={2}>
                  {providerLabel(user.oauth_provider)} login
                </Badge>
                {user.is_admin && (
                  <Badge colorScheme="purple" px={2}>
                    Admin
                  </Badge>
                )}
                {user.is_verified && (
                  <Badge colorScheme="green" px={2}>
                    Verified
                  </Badge>
                )}
              </HStack>
              {!Number.isNaN(joined.getTime()) && (
                <Text fontSize="sm" color="text.muted">
                  Member since {joined.toLocaleDateString()}
                </Text>
              )}
            </Stack>
          </HStack>
        </SectionCard>

        <SectionCard>
          <form onSubmit={handleSubmit} noValidate aria-label="Profile form">
            <Stack spacing={4}>
              <Heading as="h2" size="md">
                Edit profile
              </Heading>
              {serverError && (
                <Alert status="error" borderRadius="lg">
                  <AlertIcon />
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <FormControl isInvalid={Boolean(errors.fullName)} isRequired>
                <FormLabel htmlFor="profile-name">Full name</FormLabel>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <FormErrorMessage>{errors.fullName}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={Boolean(errors.avatarUrl)}>
                <FormLabel htmlFor="profile-avatar">Avatar URL</FormLabel>
                <Input
                  id="profile-avatar"
                  type="url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
                {errors.avatarUrl ? (
                  <FormErrorMessage>{errors.avatarUrl}</FormErrorMessage>
                ) : (
                  <FormHelperText>Optional — link to a public image.</FormHelperText>
                )}
              </FormControl>
              <HStack justify="flex-end">
                <PrimaryButton type="submit" isLoading={isSaving} loadingText="Saving...">
                  Save changes
                </PrimaryButton>
              </HStack>
            </Stack>
          </form>
        </SectionCard>
      </Stack>
    </PageWrapper>
  );
}

export default ProfilePage;
