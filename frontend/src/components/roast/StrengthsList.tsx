import { HStack, Icon, List, ListItem, Text } from '@chakra-ui/react';
import { FiCheckCircle } from 'react-icons/fi';

export interface StrengthsListProps {
  strengths: string[];
}

export function StrengthsList({ strengths }: StrengthsListProps) {
  if (strengths.length === 0) {
    return <Text color="text.muted">No strengths were listed for this roast.</Text>;
  }
  return (
    <List spacing={3} aria-label="Strengths">
      {strengths.map((strength, i) => (
        <ListItem key={`${i}-${strength}`}>
          <HStack align="flex-start" spacing={3}>
            <Icon as={FiCheckCircle} color="severity.low" boxSize={5} mt={0.5} aria-hidden="true" />
            <Text>{strength}</Text>
          </HStack>
        </ListItem>
      ))}
    </List>
  );
}

export default StrengthsList;
