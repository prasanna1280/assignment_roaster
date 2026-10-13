import { useState, type FormEvent } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Link,
  Stack,
  Text,
} from '@chakra-ui/react';
import { GradientButton } from '../ui/GradientButton';
import { PasswordInput } from './PasswordInput';
import { getRedirectPath } from './redirect';
import { PASSWORD_MIN, validateEmail, validateFullName, validatePassword } from './validation';
import { useAuth } from '../../hooks/useAuth';
import { getAuthErrorMessage } from '../../services/authService';
import { getErrorCode } from '../../services/api';

interface RegisterErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

export function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setEmailTaken(false);
    const nextErrors: RegisterErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password });
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (err) {
      const taken = getErrorCode(err) === 'email_taken';
      setEmailTaken(taken);
      if (taken) setErrors({ email: 'Indha email already register aagiruku.' });
      setServerError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Register form">
      <Stack spacing={4}>
        {serverError && (
          <Alert status="error" borderRadius="lg">
            <AlertIcon />
            <AlertDescription>
              <Text>{serverError}</Text>
              {emailTaken && (
                <Link as={RouterLink} to="/login" color="accent.fg" fontWeight="semibold">
                  Go to login
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}
        <FormControl isInvalid={Boolean(errors.fullName)} isRequired>
          <FormLabel htmlFor="register-name">Full name</FormLabel>
          <Input
            id="register-name"
            autoComplete="name"
            placeholder="Kavya Raman"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <FormErrorMessage>{errors.fullName}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={Boolean(errors.email)} isRequired>
          <FormLabel htmlFor="register-email">Email</FormLabel>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="nee@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={Boolean(errors.password)} isRequired>
          <FormLabel htmlFor="register-password">Password</FormLabel>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {errors.password ? (
            <FormErrorMessage>{errors.password}</FormErrorMessage>
          ) : (
            <FormHelperText>At least {PASSWORD_MIN} characters.</FormHelperText>
          )}
        </FormControl>
        <GradientButton type="submit" w="full" isLoading={isSubmitting} loadingText="Creating account...">
          Sign up pannunga
        </GradientButton>
      </Stack>
    </form>
  );
}

export default RegisterForm;
