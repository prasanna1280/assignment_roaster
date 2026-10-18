import { Badge, Box, Code, HStack, Heading, Stack, Text } from '@chakra-ui/react';
import type { Improvement, Severity } from '../../types';
import { SEVERITY_LABELS, sortBySeverity } from './roastUtils';
import { InlineCodeText } from './InlineCodeText';

export interface FixListProps {
  improvements: Improvement[];
}

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low'];

export function SeverityBadge({ severity }: { severity: Severity }) {
  const color = `severity.${severity}`;
  return (
    <Badge
      variant="outline"
      color={color}
      borderColor={color}
      borderWidth="1px"
      boxShadow="none"
      borderRadius="md"
      px={2}
      textTransform="uppercase"
      fontSize="0.7em"
    >
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

/** Improvements grouped by severity (most urgent first). */
export function FixList({ improvements }: FixListProps) {
  if (improvements.length === 0) {
    return <Text color="text.muted">No fixes needed. That is a rare result.</Text>;
  }
  const sorted = sortBySeverity(improvements);
  return (
    <Stack spacing={6}>
      {SEVERITY_ORDER.map((severity) => {
        const group = sorted.filter((imp) => imp.severity === severity);
        if (group.length === 0) return null;
        return (
          <Box key={severity} as="section" aria-label={`${SEVERITY_LABELS[severity]} severity fixes`}>
            <Heading
              as="h4"
              size="xs"
              textTransform="uppercase"
              letterSpacing="wider"
              color={`severity.${severity}`}
              mb={3}
            >
              {SEVERITY_LABELS[severity]} priority · {group.length}
            </Heading>
            <Stack as="ol" spacing={3} listStyleType="none">
              {group.map((imp, i) => (
                <Box
                  as="li"
                  key={`${imp.file}-${i}`}
                  data-testid="fix-item"
                  sx={{ '@media print': { breakInside: 'avoid' } }}
                  data-severity={imp.severity}
                  p={4}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="border.subtle"
                  borderLeftWidth="3px"
                  borderLeftColor={`severity.${imp.severity}`}
                  bg="bg.surface"
                >
                  <HStack spacing={2} mb={2} flexWrap="wrap">
                    <SeverityBadge severity={imp.severity} />
                    <Code fontFamily="mono" fontSize="sm" bg="transparent" px={0} wordBreak="break-all">
                      {imp.file}
                    </Code>
                    {imp.line_hint && (
                      <Text as="span" fontFamily="mono" fontSize="xs" color="text.muted">
                        ({imp.line_hint})
                      </Text>
                    )}
                  </HStack>
                  <Text fontWeight="semibold" mb={1}>
                    <InlineCodeText text={imp.issue} />
                  </Text>
                  <Text color="text.muted">
                    <Text as="span" fontWeight="semibold" color="accent.fg">
                      {'Fix: '}
                    </Text>
                    <InlineCodeText text={imp.suggestion} />
                  </Text>
                </Box>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

export default FixList;
