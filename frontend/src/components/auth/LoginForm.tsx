import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
} from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { PasswordInput } from './PasswordInput';
import { validateEmail } from './validation';
import { getRedirectPath } from './redirect';
import { useAuth } from '../../hooks/useAuth';
import { getAuthErrorMessage } from '../../services/authService';

interface LoginErrors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    const nextErrors: LoginErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'Password venum — please enter your password.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (err) {
      setServerError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Login form">
      <Stack spacing={4}>
        {serverError && (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <FormControl isInvalid={Boolean(errors.email)} isRequired>
          <FormLabel htmlFor="login-email">Email</FormLabel>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="nee@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={Boolean(errors.password)} isRequired>
          <FormLabel htmlFor="login-password">Password</FormLabel>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormErrorMessage>{errors.password}</FormErrorMessage>
        </FormControl>
        <GradientButton type="submit" w="full" isLoading={isSubmitting} loadingText="Logging in...">
          Login pannunga
        </GradientButton>
      </Stack>
    </form>
  );
}

export default LoginForm;
