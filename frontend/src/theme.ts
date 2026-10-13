import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#fff4e6',
    100: '#ffe0bf',
    200: '#ffc285',
    300: '#ff9f4a',
    400: '#ff7f1f',
    500: '#f76707',
    600: '#e8590c',
    700: '#c2410c',
    800: '#9a330a',
    900: '#6b2306',
  },
  ember: {
    50: '#fff1f0',
    100: '#ffd9d6',
    200: '#ffb0a8',
    300: '#ff8277',
    400: '#ff5a4c',
    500: '#f03e3e',
    600: '#e03131',
    700: '#c92a2a',
    800: '#a61e1e',
    900: '#7a1414',
  },
  ash: {
    50: '#f7f7f8',
    100: '#e9e9ec',
    200: '#cfcfd6',
    300: '#a9a9b5',
    400: '#7c7c8a',
    500: '#5a5a67',
    600: '#3f3f4a',
    700: '#2a2a33',
    800: '#1b1b22',
    900: '#111116',
  },
};

const semanticTokens = {
  colors: {
    'bg.canvas': { default: 'ash.50', _dark: 'ash.900' },
    'bg.surface': { default: 'white', _dark: 'ash.800' },
    'bg.glass': { default: 'whiteAlpha.800', _dark: 'whiteAlpha.100' },
    'border.subtle': { default: 'blackAlpha.200', _dark: 'whiteAlpha.200' },
    'text.primary': { default: 'ash.900', _dark: 'ash.50' },
    'text.muted': { default: 'ash.500', _dark: 'ash.300' },
    'accent.fg': { default: 'brand.600', _dark: 'brand.300' },
    'severity.low': { default: 'green.600', _dark: 'green.300' },
    'severity.medium': { default: 'orange.600', _dark: 'orange.300' },
    'severity.high': { default: 'ember.600', _dark: 'ember.400' },
  },
  shadows: {
    glow: {
      default: '0 8px 30px rgba(247, 103, 7, 0.25)',
      _dark: '0 8px 30px rgba(247, 103, 7, 0.35)',
    },
  },
};

const fonts = {
  heading: `'Space Grotesk', 'Inter', system-ui, sans-serif`,
  body: `'Inter', system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`,
};

const styles = {
  global: {
    body: {
      bg: 'bg.canvas',
      color: 'text.primary',
    },
    '::selection': {
      bg: 'brand.500',
      color: 'white',
    },
  },
};

const components = {
  Button: {
    defaultProps: { colorScheme: 'brand' },
    baseStyle: { borderRadius: 'full', fontWeight: 'semibold' },
  },
  Input: {
    defaultProps: { focusBorderColor: 'brand.400' },
  },
  Textarea: {
    defaultProps: { focusBorderColor: 'brand.400' },
  },
  Link: {
    baseStyle: { _hover: { textDecoration: 'none' } },
  },
};

export const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts,
  styles,
  components,
});

/** Chakra `bgGradient` value for the fiery brand gradient. */
export const brandGradient = 'linear(to-r, brand.400, ember.500)';

export default theme;
