import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
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
      setError('Google login-la tokens kidaikala. Once more try pannunga.');
      return;
    }
    completeOAuth(tokens.accessToken, tokens.refreshToken)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((err: unknown) => setError(getAuthErrorMessage(err)));
  }, [completeOAuth, navigate]);

  return (
    <Center minH="100vh" bg="bg.canvas" px={4}>
      {error ? (
        <GlassCard disableHover maxW="md" w="full" textAlign="center">
          <Stack spacing={4} align="center" role="alert">
            <Heading as="h1" size="lg">
              Aiyo, login aagala 😕
            </Heading>
            <Text color="text.muted">{error}</Text>
            <GradientButton to="/login">Back to login</GradientButton>
          </Stack>
        </GlassCard>
      ) : (
        <Stack spacing={4} align="center" role="status" aria-live="polite">
          <Spinner size="xl" thickness="4px" color="accent.fg" />
          <Text color="text.muted">Google-la irundhu login panrom... konjam wait pannunga</Text>
        </Stack>
      )}
    </Center>
  );
}

export default OAuthCallbackPage;
