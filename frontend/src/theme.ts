import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// Classic, flat look: navy accent on slate neutrals. No gradients, glass or glows.
const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: '#eef2f8',
    100: '#d5deec',
    200: '#adbdd8',
    300: '#8199bf',
    400: '#5875a3',
    500: '#3b5a8a',
    600: '#2c4770',
    700: '#1f3657',
    800: '#172a45',
    900: '#0f1d33',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#0a101e',
  },
};

const semanticTokens = {
  colors: {
    'bg.canvas': { default: 'slate.50', _dark: 'slate.950' },
    'bg.surface': { default: 'white', _dark: 'slate.900' },
    'bg.subtle': { default: 'slate.100', _dark: 'slate.800' },
    'border.subtle': { default: 'slate.200', _dark: 'slate.800' },
    'border.strong': { default: 'slate.300', _dark: 'slate.600' },
    'text.primary': { default: 'slate.900', _dark: 'slate.100' },
    'text.muted': { default: 'slate.600', _dark: 'slate.400' },
    'accent.fg': { default: 'brand.600', _dark: 'brand.200' },
    'accent.solid': { default: 'brand.600', _dark: 'brand.300' },
    'accent.subtle': { default: 'brand.50', _dark: 'rgba(129, 153, 191, 0.12)' },
    'severity.low': { default: 'green.700', _dark: 'green.300' },
    'severity.medium': { default: 'orange.600', _dark: 'orange.300' },
    'severity.high': { default: 'red.600', _dark: 'red.300' },
  },
  shadows: {
    card: {
      default: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
      _dark: 'none',
    },
    cardHover: {
      default: '0 4px 12px rgba(15, 23, 42, 0.08)',
      _dark: '0 0 0 1px rgba(148, 163, 184, 0.25)',
    },
  },
};

const fonts = {
  heading: `'Inter', system-ui, sans-serif`,
  body: `'Inter', system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`,
};

const styles = {
  global: {
    body: {
      bg: 'bg.canvas',
      color: 'text.primary',
      WebkitFontSmoothing: 'antialiased',
    },
    '@media print': {
      body: { bg: 'white' },
    },
    '@page': { margin: '14mm' },
    '::selection': {
      bg: 'brand.100',
      color: 'brand.900',
    },
  },
};

const components = {
  Heading: {
    baseStyle: { fontWeight: 'semibold', letterSpacing: '-0.015em', color: 'text.primary' },
  },
  Button: {
    defaultProps: { colorScheme: 'brand' },
    baseStyle: { borderRadius: 'md', fontWeight: 'semibold' },
  },
  IconButton: {
    baseStyle: { borderRadius: 'md' },
  },
  Avatar: {
    baseStyle: { container: { bg: 'brand.600', color: 'white' } },
  },
  Badge: {
    baseStyle: { borderRadius: 'sm', textTransform: 'none', fontWeight: 'medium', letterSpacing: 'normal' },
  },
  Input: {
    defaultProps: { focusBorderColor: 'brand.500' },
  },
  Textarea: {
    defaultProps: { focusBorderColor: 'brand.500' },
  },
  Select: {
    defaultProps: { focusBorderColor: 'brand.500' },
  },
  Alert: {
    baseStyle: { container: { borderRadius: 'md' } },
  },
  Link: {
    baseStyle: { _hover: { textDecoration: 'underline' } },
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

export default theme;
