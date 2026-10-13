import { Link as RouterLink, NavLink, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Link,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  Stack,
  Text,
  useColorMode,
  useColorModeValue,
  useDisclosure,
} from '@chakra-ui/react';
import { FiLogOut, FiMenu, FiMoon, FiSettings, FiSun, FiUser } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { GradientButton } from '../ui/GradientButton';

interface NavItem {
  label: string;
  to: string;
}

const AUTH_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Roast a Repo', to: '/roast/new' },
  { label: 'History', to: '/submissions' },
];

const MotionIconButton = motion.create(IconButton);

export function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const activeColor = useColorModeValue('brand.600', 'brand.300');
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const drawer = useDisclosure();

  const handleLogout = async () => {
    drawer.onClose();
    await logout();
    navigate('/login', { replace: true });
  };

  const colorModeToggle = (
    <MotionIconButton
      aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      icon={colorMode === 'dark' ? <FiSun /> : <FiMoon />}
      onClick={toggleColorMode}
      variant="ghost"
      colorScheme="brand"
      borderRadius="full"
      whileHover={{ scale: 1.1, rotate: 15 }}
      whileTap={{ scale: 0.9 }}
    />
  );

  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="sticky"
      bg="bg.glass"
      backdropFilter="blur(14px)"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Container maxW="container.xl" px={{ base: 4, md: 6 }}>
        <Flex h="64px" align="center" justify="space-between" gap={4}>
          <Link as={RouterLink} to="/" _hover={{ opacity: 0.85 }}>
            <Text
              fontFamily="heading"
              fontWeight="bold"
              fontSize={{ base: 'md', md: 'xl' }}
              bgGradient="linear(to-r, brand.300, ember.400)"
              bgClip="text"
              whiteSpace="nowrap"
            >
              🔥 Assignment Roaster
            </Text>
          </Link>

          {/* Desktop */}
          <HStack spacing={6} display={{ base: 'none', md: 'flex' }}>
            {isAuthenticated && (
              <HStack as="nav" aria-label="Main" spacing={6}>
                {AUTH_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    as={NavLink}
                    to={item.to}
                    fontWeight="medium"
                    color="text.muted"
                    _hover={{ color: activeColor }}
                    _activeLink={{ color: activeColor }}
                  >
                    {item.label}
                  </Link>
                ))}
              </HStack>
            )}
            {colorModeToggle}
            {isAuthenticated && user ? (
              <Menu placement="bottom-end">
                <MenuButton
                  as={Button}
                  variant="ghost"
                  borderRadius="full"
                  p={1}
                  h="auto"
                  aria-label="Account menu"
                >
                  <Avatar size="sm" name={user.full_name} src={user.avatar_url ?? undefined} />
                </MenuButton>
                <MenuList>
                  <MenuGroup title={user.email}>
                    <MenuItem as={RouterLink} to="/profile" icon={<FiUser />}>
                      Profile
                    </MenuItem>
                    <MenuItem as={RouterLink} to="/settings" icon={<FiSettings />}>
                      Settings
                    </MenuItem>
                  </MenuGroup>
                  <MenuDivider />
                  <MenuItem icon={<FiLogOut />} onClick={handleLogout}>
                    Logout
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              !isLoading && (
                <HStack spacing={3}>
                  <Button as={RouterLink} to="/login" variant="ghost" borderRadius="full">
                    Login
                  </Button>
                  <GradientButton to="/register" py={4} px={5}>
                    Sign up
                  </GradientButton>
                </HStack>
              )
            )}
          </HStack>

          {/* Mobile */}
          <HStack spacing={1} display={{ base: 'flex', md: 'none' }}>
            {colorModeToggle}
            <IconButton
              aria-label="Open menu"
              icon={<FiMenu />}
              variant="ghost"
              borderRadius="full"
              onClick={drawer.onOpen}
            />
          </HStack>
        </Flex>
      </Container>

      <Drawer isOpen={drawer.isOpen} placement="right" onClose={drawer.onClose}>
        <DrawerOverlay />
        <DrawerContent bg="bg.surface">
          <DrawerCloseButton />
          <DrawerHeader>
            {isAuthenticated && user ? (
              <HStack spacing={3}>
                <Avatar size="sm" name={user.full_name} src={user.avatar_url ?? undefined} />
                <Box minW={0}>
                  <Text fontSize="md" noOfLines={1}>
                    {user.full_name}
                  </Text>
                  <Text fontSize="xs" color="text.muted" fontWeight="normal" noOfLines={1}>
                    {user.email}
                  </Text>
                </Box>
              </HStack>
            ) : (
              'Menu'
            )}
          </DrawerHeader>
          <DrawerBody>
            {isAuthenticated ? (
              <Stack as="nav" aria-label="Mobile" spacing={1}>
                {[...AUTH_NAV_ITEMS, { label: 'Profile', to: '/profile' }, { label: 'Settings', to: '/settings' }].map(
                  (item) => (
                    <Link
                      key={item.to}
                      as={NavLink}
                      to={item.to}
                      onClick={drawer.onClose}
                      py={2}
                      fontWeight="medium"
                      color="text.muted"
                      _activeLink={{ color: activeColor }}
                    >
                      {item.label}
                    </Link>
                  ),
                )}
                <Divider my={2} />
                <Button leftIcon={<FiLogOut />} variant="ghost" justifyContent="flex-start" onClick={handleLogout}>
                  Logout
                </Button>
              </Stack>
            ) : (
              <Stack spacing={3}>
                <Button as={RouterLink} to="/login" variant="outline" borderRadius="full" onClick={drawer.onClose}>
                  Login
                </Button>
                <GradientButton to="/register" w="full" onClick={drawer.onClose}>
                  Sign up
                </GradientButton>
              </Stack>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}

export default Navbar;
