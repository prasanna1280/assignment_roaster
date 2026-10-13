import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Link, Stack, Text } from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { AuthCard } from '../components/auth/AuthCard';
import { RegisterForm } from '../components/auth/RegisterForm';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { OrDivider } from '../components/auth/OrDivider';

export function RegisterPage() {
  const location = useLocation();
  return (
    <PageWrapper maxW="container.sm">
      <AuthCard
        title="Pudhu account create pannunga"
        subtitle="Sign up and get your first repo roasted in minutes."
        footer={
          <Text>
            Already account iruka?{' '}
            <Link as={RouterLink} to="/login" state={location.state} color="accent.fg" fontWeight="semibold">
              Login pannunga
            </Link>
          </Text>
        }
      >
        <Stack spacing={5}>
          <RegisterForm />
          <OrDivider />
          <GoogleLoginButton>Sign up with Google</GoogleLoginButton>
        </Stack>
      </AuthCard>
    </PageWrapper>
  );
}

export default RegisterPage;
