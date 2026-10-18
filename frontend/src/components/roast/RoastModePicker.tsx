import {
  Box,
  FormControl,
  FormLabel,
  SimpleGrid,
  Stack,
  Text,
  useRadio,
  useRadioGroup,
  type UseRadioProps,
} from '@chakra-ui/react';
import { ROAST_LANGUAGES, ROAST_LEVELS, type RoastOption } from '../../lib/roastModes';
import type { RoastLanguage, RoastLevel } from '../../types';

interface OptionCardProps extends UseRadioProps {
  option: RoastOption<string>;
}

function OptionCard({ option, ...radioProps }: OptionCardProps) {
  const { getInputProps, getRadioProps, getRootProps } = useRadio(radioProps);
  return (
    <Box as="label" {...getRootProps()} cursor={radioProps.isDisabled ? 'not-allowed' : 'pointer'}>
      {/* The visual card is aria-hidden, so the input carries the accessible name. */}
      <input {...getInputProps({ 'aria-label': `${option.label}: ${option.description}` })} />
      <Box
        {...getRadioProps()}
        h="full"
        px={4}
        py={3}
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="lg"
        bg="bg.surface"
        transition="border-color 0.15s, background-color 0.15s"
        _hover={{ borderColor: 'border.strong' }}
        _checked={{ borderColor: 'accent.solid', bg: 'accent.subtle', boxShadow: 'inset 0 0 0 1px var(--chakra-colors-accent-solid)' }}
        _focusVisible={{ boxShadow: 'outline' }}
        _disabled={{ opacity: 0.6 }}
      >
        <Text fontWeight="semibold" fontSize="sm">
          {option.label}
        </Text>
        <Text fontSize="xs" color="text.muted" mt={0.5}>
          {option.description}
        </Text>
      </Box>
    </Box>
  );
}

interface OptionGroupProps<T extends string> {
  name: string;
  label: string;
  options: RoastOption<T>[];
  value: T;
  onChange: (value: T) => void;
  isDisabled?: boolean;
}

function OptionGroup<T extends string>({ name, label, options, value, onChange, isDisabled }: OptionGroupProps<T>) {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name,
    value,
    onChange: (next: string) => onChange(next as T),
    isDisabled,
  });
  return (
    <FormControl as="fieldset" isDisabled={isDisabled}>
      <FormLabel as="legend">{label}</FormLabel>
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} {...getRootProps()}>
        {options.map((option) => (
          <OptionCard key={option.value} option={option} {...getRadioProps({ value: option.value })} />
        ))}
      </SimpleGrid>
    </FormControl>
  );
}

export interface RoastModePickerProps {
  level: RoastLevel;
  language: RoastLanguage;
  onLevelChange: (level: RoastLevel) => void;
  onLanguageChange: (language: RoastLanguage) => void;
  isDisabled?: boolean;
}

/** Roast level and language selectors, shared by the new-roast form and the re-roast dialog. */
export function RoastModePicker({ level, language, onLevelChange, onLanguageChange, isDisabled }: RoastModePickerProps) {
  return (
    <Stack spacing={5}>
      <OptionGroup
        name="roast_level"
        label="Roast level"
        options={ROAST_LEVELS}
        value={level}
        onChange={onLevelChange}
        isDisabled={isDisabled}
      />
      <OptionGroup
        name="roast_language"
        label="Language"
        options={ROAST_LANGUAGES}
        value={language}
        onChange={onLanguageChange}
        isDisabled={isDisabled}
      />
    </Stack>
  );
}

export default RoastModePicker;
