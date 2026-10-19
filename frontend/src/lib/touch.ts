import type { SystemStyleObject } from '@chakra-ui/react';

/**
 * Grow a small text link's tap area to about 40px tall for touch screens.
 * The padding is cancelled by an equal negative margin, so the layout doesn't move.
 */
export const touchTarget: SystemStyleObject = { py: 2.5, my: -2.5 };
