import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { AuthCard } from '../components/auth/AuthCard';
import { GradientButton } from '../components/ui/GradientButton';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { validateEmail } from '../components/auth/validation';

/** UI-only for the MVP: password reset email is not implemented on the backend yet. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailError = validateEmail(email);
    setError(emailError);
    setSubmitted(!emailError);
  };

  return (
    <PageWrapper maxW="container.sm">
      <AuthCard
        title="Password marandhuteengala?"
        subtitle="No tension — namma help panrom."
        footer={
          <Text>
            Nyabagam vandhuducha?{' '}
            <Link as={RouterLink} to="/login" color="accent.fg" fontWeight="semibold">
              Back to login
            </Link>
          </Text>
        }
      >
        <Stack spacing={5}>
          {submitted && (
            <Alert status="info" borderRadius="lg">
              <AlertIcon />
              <AlertDescription>
                Password reset email coming soon — for now, Google login try pannunga.
              </AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} noValidate aria-label="Forgot password form">
            <Stack spacing={4}>
              <FormControl isInvalid={Boolean(error)} isRequired>
                <FormLabel htmlFor="forgot-email">Email</FormLabel>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nee@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FormErrorMessage>{error}</FormErrorMessage>
              </FormControl>
              <GradientButton type="submit" w="full">
                Send reset link
              </GradientButton>
            </Stack>
          </form>
          {submitted && <GoogleLoginButton />}
        </Stack>
      </AuthCard>
    </PageWrapper>
  );
}

export default ForgotPasswordPage;
