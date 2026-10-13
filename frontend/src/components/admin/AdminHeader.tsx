import { NavLink } from 'react-router-dom';
import { Heading, HStack, Link, Stack, Text, useColorModeValue } from '@chakra-ui/react';

const ADMIN_NAV_ITEMS = [
  { label: 'Overview', to: '/admin', end: true },
  { label: 'Users', to: '/admin/users', end: false },
  { label: 'Submissions', to: '/admin/submissions', end: false },
];

export interface AdminHeaderProps {
  title: string;
  subtitle: string;
}

/** Page title plus the admin section tabs (Overview / Users / Submissions). */
export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  const activeColor = useColorModeValue('brand.600', 'brand.300');

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Text fontSize="sm" fontWeight="semibold" color="accent.fg" textTransform="uppercase" letterSpacing="wider">
          Admin
        </Text>
        <Heading as="h1" size="xl">
          {title}
        </Heading>
        <Text color="text.muted">{subtitle}</Text>
      </Stack>
      <HStack as="nav" aria-label="Admin sections" spacing={6} borderBottomWidth="1px" borderColor="border.subtle">
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            as={NavLink}
            to={item.to}
            end={item.end}
            pb={2}
            mb="-1px"
            fontWeight="medium"
            color="text.muted"
            borderBottomWidth="2px"
            borderColor="transparent"
            _hover={{ color: activeColor }}
            _activeLink={{ color: activeColor, borderColor: activeColor }}
          >
            {item.label}
          </Link>
        ))}
      </HStack>
    </Stack>
  );
}

export default AdminHeader;
