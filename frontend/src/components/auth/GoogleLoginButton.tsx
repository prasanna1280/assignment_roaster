import { Button, type ButtonProps } from '@chakra-ui/react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../hooks/useAuth';

export type GoogleLoginButtonProps = Omit<ButtonProps, 'onClick' | 'leftIcon'>;

/** Starts the Google OAuth flow via a full-page navigation to the backend. */
export function GoogleLoginButton({ children = 'Continue with Google', ...rest }: GoogleLoginButtonProps) {
  const { loginWithGoogle } = useAuth();
  return (
    <Button
      w="full"
      variant="outline"
      borderRadius="full"
      size="lg"
      leftIcon={<FcGoogle />}
      onClick={loginWithGoogle}
      {...rest}
    >
      {children}
    </Button>
  );
}

export default GoogleLoginButton;
