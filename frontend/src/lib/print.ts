import type { SystemStyleObject } from '@chakra-ui/react';

/** Hide an element when the page is printed or saved as PDF. */
export const hideWhenPrinting: SystemStyleObject = { '@media print': { display: 'none' } };

/** Show an element only when the page is printed or saved as PDF. */
export const showOnlyWhenPrinting: SystemStyleObject = {
  display: 'none',
  '@media print': { display: 'block' },
};

/** Use a desktop-style row on paper, where the viewport is narrower than md. */
export const rowWhenPrinting: SystemStyleObject = { '@media print': { flexDirection: 'row' } };

/** Two equal columns on paper. */
export const twoColumnsWhenPrinting: SystemStyleObject = {
  '@media print': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
};

/** Long blocks may flow across printed pages. */
export const allowPrintBreak: SystemStyleObject = { '@media print': { breakInside: 'auto' } };

/** Keep a block on one printed page where possible. */
export const avoidPrintBreak: SystemStyleObject = {
  '@media print': { breakInside: 'avoid', boxShadow: 'none' },
};
