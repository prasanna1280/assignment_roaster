import { Box, Heading, Text } from '@chakra-ui/react';

export interface RoastHeadlineProps {
  headline: string;
}

export function RoastHeadline({ headline }: RoastHeadlineProps) {
  return (
    <Box borderLeftWidth="3px" borderColor="accent.solid" pl={5}>
      <Text fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" color="text.muted" mb={2}>
        Verdict
      </Text>
      <Heading as="h2" size="lg" lineHeight="1.3">
        {headline}
      </Heading>
    </Box>
  );
}

export default RoastHeadline;
