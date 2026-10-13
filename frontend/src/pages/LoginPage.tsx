import { Link as RouterLink, useLocation, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertIcon, Flex, Link, Stack, Text } from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { AuthCard } from '../components/auth/AuthCard';
import { LoginForm } from '../components/auth/LoginForm';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { OrDivider } from '../components/auth/OrDivider';
import { AUTH_ERROR_MESSAGES } from '../services/authService';

const OAUTH_ERRORS = new Set(['oauth_state', 'oauth_failed', 'account_disabled', 'google_not_configured']);

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const errorParam = searchParams.get('error');
  const oauthError =
    errorParam !== null
      ? OAUTH_ERRORS.has(errorParam)
        ? AUTH_ERROR_MESSAGES[errorParam]
        : 'Login-la edho problem aagiduchu. Once more try pannunga.'
      : null;

  return (
    <PageWrapper maxW="container.sm">
      <AuthCard
        title="Vaanga! Login pannunga"
        subtitle="Welcome back — un code roast-ku ready-ah?"
        footer={
          <Text>
            Account illaya?{' '}
            <Link as={RouterLink} to="/register" state={location.state} color="accent.fg" fontWeight="semibold">
              Sign up pannunga
            </Link>
          </Text>
        }
      >
        <Stack spacing={5}>
          {oauthError && (
            <Alert status="warning" borderRadius="lg">
              <AlertIcon />
              <AlertDescription>{oauthError}</AlertDescription>
            </Alert>
          )}
          <LoginForm />
          <Flex justify="flex-end">
            <Link as={RouterLink} to="/forgot-password" fontSize="sm" color="accent.fg">
              Password marandhuteengala?
            </Link>
          </Flex>
          <OrDivider />
          <GoogleLoginButton />
        </Stack>
      </AuthCard>
    </PageWrapper>
  );
}

export default LoginPage;
