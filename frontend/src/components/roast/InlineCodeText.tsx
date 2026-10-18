import { Fragment } from 'react';
import { Code } from '@chakra-ui/react';

const BACKTICK_SPAN = /`([^`\n]+)`/g;

export interface InlineCodeTextProps {
  text: string;
}

/**
 * Renders `backtick` spans as inline code. Everything else stays plain text, so
 * AI output is never interpreted as HTML or Markdown.
 */
export function InlineCodeText({ text }: InlineCodeTextProps) {
  const parts = text.split(BACKTICK_SPAN);
  return (
    <>
      {parts.map((part, i) =>
        // split() with a capture group puts the captured code at odd indexes.
        i % 2 === 1 ? (
          <Code key={i} colorScheme="gray" fontSize="0.9em" px={1} borderRadius="sm">
            {part}
          </Code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export default InlineCodeText;
