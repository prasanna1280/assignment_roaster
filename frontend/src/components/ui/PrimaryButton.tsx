import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, type ButtonProps } from '@chakra-ui/react';

export interface PrimaryButtonProps extends ButtonProps {
  children: ReactNode;
  /** When set, renders the button as a react-router link to this path. */
  to?: string;
}

/** The main call-to-action button: solid navy, no gradient. */
export function PrimaryButton({ children, to, ...rest }: PrimaryButtonProps) {
  if (to) {
    return (
      <Button as={RouterLink} to={to} colorScheme="brand" {...rest}>
        {children}
      </Button>
    );
  }
  return (
    <Button colorScheme="brand" {...rest}>
      {children}
    </Button>
  );
}

export default PrimaryButton;
