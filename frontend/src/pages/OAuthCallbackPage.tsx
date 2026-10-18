import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { SectionCard } from '../components/ui/SectionCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { useAuth } from '../hooks/useAuth';
import { getAuthErrorMessage } from '../services/authService';
import { parseOAuthHash } from '../components/auth/redirect';

export function OAuthCallbackPage() {
  const { completeOAuth } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invocation (the hash is cleared on first run).
    if (started.current) return;
    started.current = true;

    const tokens = parseOAuthHash(window.location.hash);
    // Never leave tokens sitting in the address bar / history.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);

    if (!tokens) {
      setError('Google sign-in did not return a session. Please try again.');
      return;
    }
    completeOAuth(tokens.accessToken, tokens.refreshToken)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((err: unknown) => setError(getAuthErrorMessage(err)));
  }, [completeOAuth, navigate]);

  return (
    <Center minH="100vh" bg="bg.canvas" px={4}>
      {error ? (
        <SectionCard maxW="md" w="full" textAlign="center">
          <Stack spacing={4} align="center" role="alert">
            <Heading as="h1" size="lg">
              Sign-in failed
            </Heading>
            <Text color="text.muted">{error}</Text>
            <PrimaryButton to="/login">Back to login</PrimaryButton>
          </Stack>
        </SectionCard>
      ) : (
        <Stack spacing={4} align="center" role="status" aria-live="polite">
          <Spinner size="xl" thickness="4px" color="accent.fg" />
          <Text color="text.muted">Signing you in with Google…</Text>
        </Stack>
      )}
    </Center>
  );
}

export default OAuthCallbackPage;
