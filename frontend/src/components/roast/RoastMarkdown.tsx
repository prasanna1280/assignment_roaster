import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import {
  Box,
  Code,
  Divider,
  Heading,
  Link,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from '@chakra-ui/react';

interface ChildrenProps {
  children?: ReactNode;
}

const components: Components = {
  h1: ({ children }: ChildrenProps) => (
    <Heading as="h3" size="lg" mt={6} mb={3}>
      {children}
    </Heading>
  ),
  h2: ({ children }: ChildrenProps) => (
    <Heading as="h3" size="md" mt={6} mb={3}>
      {children}
    </Heading>
  ),
  h3: ({ children }: ChildrenProps) => (
    <Heading as="h4" size="sm" mt={5} mb={2}>
      {children}
    </Heading>
  ),
  h4: ({ children }: ChildrenProps) => (
    <Heading as="h5" size="xs" mt={4} mb={2}>
      {children}
    </Heading>
  ),
  p: ({ children }: ChildrenProps) => (
    <Text mb={4} lineHeight="tall">
      {children}
    </Text>
  ),
  a: ({ children, href }: ChildrenProps & { href?: string }) => (
    <Link href={href} color="accent.fg" textDecoration="underline" isExternal rel="noopener noreferrer">
      {children}
    </Link>
  ),
  ul: ({ children }: ChildrenProps) => (
    <UnorderedList mb={4} spacing={1.5} pl={2}>
      {children}
    </UnorderedList>
  ),
  ol: ({ children }: ChildrenProps) => (
    <OrderedList mb={4} spacing={1.5} pl={2}>
      {children}
    </OrderedList>
  ),
  li: ({ children }: ChildrenProps) => <ListItem>{children}</ListItem>,
  strong: ({ children }: ChildrenProps) => (
    <Text as="strong" fontWeight="bold" color="accent.fg">
      {children}
    </Text>
  ),
  em: ({ children }: ChildrenProps) => (
    <Text as="em" fontStyle="italic">
      {children}
    </Text>
  ),
  blockquote: ({ children }: ChildrenProps) => (
    <Box as="blockquote" borderLeftWidth="4px" borderColor="brand.400" pl={4} py={1} my={4} color="text.muted">
      {children}
    </Box>
  ),
  code: ({ children }: ChildrenProps) => (
    <Code colorScheme="orange" fontSize="0.9em" px={1.5} borderRadius="md">
      {children}
    </Code>
  ),
  pre: ({ children }: ChildrenProps) => (
    <Box
      as="pre"
      my={4}
      p={4}
      bg="blackAlpha.500"
      borderRadius="lg"
      overflowX="auto"
      fontFamily="mono"
      fontSize="sm"
      sx={{ '& code': { bg: 'transparent', p: 0, color: 'inherit', whiteSpace: 'pre' } }}
    >
      {children}
    </Box>
  ),
  hr: () => <Divider my={6} borderColor="border.subtle" />,
};

export interface RoastMarkdownProps {
  content: string;
}

/** Renders AI roast markdown safely (raw HTML dropped, output sanitized). */
export function RoastMarkdown({ content }: RoastMarkdownProps) {
  return (
    <Box data-testid="roast-markdown" fontSize={{ base: 'md', md: 'lg' }}>
      <ReactMarkdown skipHtml rehypePlugins={[rehypeSanitize]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  );
}

export default RoastMarkdown;
