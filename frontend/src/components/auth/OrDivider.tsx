import { Divider, HStack, Text } from '@chakra-ui/react';

/** Horizontal "or" separator between the email form and social login. */
export function OrDivider() {
  return (
    <HStack spacing={3} role="separator" aria-label="or">
      <Divider borderColor="border.subtle" />
      <Text fontSize="sm" color="text.muted" textTransform="uppercase" letterSpacing="wider">
        or
      </Text>
      <Divider borderColor="border.subtle" />
    </HStack>
  );
}

export default OrDivider;
