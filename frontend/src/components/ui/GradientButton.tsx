import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, type ButtonProps } from '@chakra-ui/react';
import { MotionBox } from '../../lib/motion';

export interface GradientButtonProps extends ButtonProps {
  children: ReactNode;
  /** When set, renders the button as a react-router link to this path. */
  to?: string;
}

export function GradientButton({ children, to, isDisabled, isLoading, w, width, ...rest }: GradientButtonProps) {
  const inactive = Boolean(isDisabled) || Boolean(isLoading);
  const fullWidth = w ?? width;

  const buttonProps: ButtonProps = {
    px: 7,
    py: 6,
    w: fullWidth,
    borderRadius: 'full',
    fontWeight: 'semibold',
    color: 'white',
    bgGradient: 'linear(to-r, brand.400, ember.500)',
    _hover: { bgGradient: 'linear(to-r, brand.500, ember.600)', boxShadow: 'glow' },
    _active: { bgGradient: 'linear(to-r, brand.600, ember.700)' },
    isDisabled,
    isLoading,
    ...rest,
  };

  return (
    <MotionBox
      display={fullWidth ? 'block' : 'inline-block'}
      w={fullWidth}
      tabIndex={-1}
      whileHover={inactive ? undefined : { scale: 1.03, y: -2 }}
      whileTap={inactive ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {to ? (
        <Button as={RouterLink} to={to} {...buttonProps}>
          {children}
        </Button>
      ) : (
        <Button {...buttonProps}>{children}</Button>
      )}
    </MotionBox>
  );
}

export default GradientButton;
