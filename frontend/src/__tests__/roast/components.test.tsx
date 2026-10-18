import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { ScoreRing } from '../../components/roast/ScoreRing';
import { CategoryBars } from '../../components/roast/CategoryBars';
import { FixList } from '../../components/roast/FixList';
import { RoastMarkdown } from '../../components/roast/RoastMarkdown';
import { renderWithProviders } from '../testUtils';
import { mockRoast } from './fixtures';

describe('ScoreRing', () => {
  it('renders the score as an accessible meter', () => {
    renderWithProviders(<ScoreRing score={7.5} />, { withAuth: false });
    const meter = screen.getByRole('meter', { name: /overall score/i });
    expect(meter).toHaveAttribute('aria-valuenow', '7.5');
    expect(meter).toHaveAttribute('aria-valuetext', '7.5 out of 10');
    expect(within(meter).getByText('7.5')).toBeInTheDocument();
  });

  it('accepts string scores and clamps', () => {
    renderWithProviders(<ScoreRing score="11" />, { withAuth: false });
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '10');
  });
});

describe('CategoryBars', () => {
  it('renders all six labelled categories with values', () => {
    renderWithProviders(<CategoryBars scores={mockRoast.category_scores} />, { withAuth: false });
    const labels = ['Code Quality', 'Structure', 'Readability', 'Documentation', 'Testing', 'Best Practices'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole('meter', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('meter', { name: 'Readability' })).toHaveAttribute('aria-valuenow', '6.5');
    expect(screen.getByTestId('category-testing')).toHaveTextContent('2 / 10');
  });
});

describe('FixList', () => {
  it('orders fixes high → medium → low and shows file + line hint', () => {
    renderWithProviders(<FixList improvements={mockRoast.improvements} />, { withAuth: false });
    const items = screen.getAllByTestId('fix-item');
    expect(items.map((el) => el.getAttribute('data-severity'))).toEqual(['high', 'medium', 'low']);
    expect(within(items[0] as HTMLElement).getByText('app/main.py')).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText('(L10-L40)')).toBeInTheDocument();
  });

  it('shows an empty message when there is nothing to fix', () => {
    renderWithProviders(<FixList improvements={[]} />, { withAuth: false });
    expect(screen.getByText(/no fixes needed/i)).toBeInTheDocument();
  });
});

describe('RoastMarkdown', () => {
  it('renders markdown but strips scripts and javascript: links', () => {
    const content = [
      '# Hello',
      '',
      'Some **bold** text <script>alert("xss")</script>',
      '',
      '<img src="x" onerror="alert(1)" />',
      '',
      '[evil](javascript:alert(1)) and [good](https://example.com)',
    ].join('\n');
    const { container } = renderWithProviders(<RoastMarkdown content={content} />, { withAuth: false });

    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:/i);
    expect(container.innerHTML).not.toMatch(/onerror/i);

    const good = screen.getByRole('link', { name: 'good' });
    expect(good).toHaveAttribute('href', 'https://example.com');
    expect(good).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
