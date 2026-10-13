import type { ChangeEvent } from 'react';
import {
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
} from '@chakra-ui/react';
import { FiCheckCircle, FiGithub } from 'react-icons/fi';
import { parseRepoUrl } from '../../lib/repoUrl';

export interface RepoUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Validation error to show (only shown when non-null). */
  error: string | null;
  isDisabled?: boolean;
}

export function RepoUrlInput({ value, onChange, onBlur, error, isDisabled = false }: RepoUrlInputProps) {
  const parsed = error ? null : parseRepoUrl(value);

  return (
    <FormControl isRequired isInvalid={Boolean(error)} isDisabled={isDisabled}>
      <FormLabel htmlFor="repo-url">GitHub repo URL</FormLabel>
      <InputGroup size="lg">
        <InputLeftElement pointerEvents="none">
          <Icon as={FiGithub} color="text.muted" aria-hidden="true" />
        </InputLeftElement>
        <Input
          id="repo-url"
          name="repo_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://github.com/your-name/your-assignment"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onBlur={onBlur}
          fontFamily="mono"
          fontSize="md"
        />
      </InputGroup>
      {error ? (
        <FormErrorMessage>{error}</FormErrorMessage>
      ) : parsed ? (
        <FormHelperText>
          <HStack spacing={1.5} color="severity.low">
            <Icon as={FiCheckCircle} aria-hidden="true" />
            <Text as="span" fontFamily="mono">
              {parsed.owner}/{parsed.repo}
              {parsed.branch ? ` @ ${parsed.branch}` : ''}
            </Text>
          </HStack>
        </FormHelperText>
      ) : (
        <FormHelperText>Public repos only — no GitHub login needed.</FormHelperText>
      )}
    </FormControl>
  );
}

export default RepoUrlInput;
