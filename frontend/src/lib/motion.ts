import { Box, Button, Flex } from '@chakra-ui/react';
import { motion } from 'framer-motion';

/** Chakra primitives wrapped with framer-motion (accept Chakra style props + motion props). */
export const MotionBox = motion.create(Box);
export const MotionFlex = motion.create(Flex);
export const MotionButton = motion.create(Button);
