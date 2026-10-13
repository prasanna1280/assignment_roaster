import { Heading, HStack, Icon } from '@chakra-ui/react';
import { FaFire } from 'react-icons/fa';
import { brandGradient } from '../../theme';

export interface RoastHeadlineProps {
  headline: string;
}

export function RoastHeadline({ headline }: RoastHeadlineProps) {
  return (
    <HStack align="flex-start" spacing={3}>
      <Icon as={FaFire} boxSize={7} color="brand.400" mt={1} aria-hidden="true" />
      <Heading as="h2" size="lg" lineHeight="1.25" bgGradient={brandGradient} bgClip="text">
        {headline}
      </Heading>
    </HStack>
  );
}

export default RoastHeadline;
