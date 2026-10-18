import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { NewRoastPage } from '../../pages/NewRoastPage';
import { SubmissionDetailPage } from '../../pages/SubmissionDetailPage';
import { submissionService } from '../../services/submissionService';
import { renderWithProviders } from '../testUtils';
import { makeSubmission } from './fixtures';

vi.mock('../../services/submissionService', () => ({
  submissionService: {
    create: vi.fn(),
    list: vi.fn(),
    getQuota: vi.fn(),
    get: vi.fn(),
    reroast: vi.fn(),
    remove: vi.fn(),
  },
}));

const mocked = vi.mocked(submissionService);

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocked.getQuota.mockResolvedValue({ used: 1, limit: 3, resets_at: '2026-10-11T00:00:00Z' });
});

function renderNewRoast() {
  return renderWithProviders(
    <Routes>
      <Route path="/roast/new" element={<NewRoastPage />} />
      <Route path="/submissions/:id" element={<div>Detail page reached</div>} />
    </Routes>,
    { route: '/roast/new', withAuth: false },
  );
}

describe('NewRoastPage', () => {
  it('shows a validation error for an invalid repo URL and does not submit', async () => {
    const user = userEvent.setup();
    renderNewRoast();

    await user.click(screen.getByLabelText(/github repo url/i));
    await user.paste('https://gitlab.com/kavya/todo');
    await user.click(screen.getByRole('button', { name: /roast it/i }));

    expect(await screen.findByText(/only https:\/\/github\.com\/ links work/i)).toBeInTheDocument();
    expect(mocked.create).not.toHaveBeenCalled();
  });

  it('creates a submission on valid submit and navigates to it', async () => {
    const user = userEvent.setup();
    mocked.create.mockResolvedValue(makeSubmission({ id: 77, status: 'queued', latest_roast: null }));
    renderNewRoast();

    expect(await screen.findByText(/2 of 3 roasts left today/i)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/github repo url/i));
    await user.paste('https://github.com/kavya/todo-api');
    await user.type(screen.getByLabelText(/assignment title/i), 'Week 3');
    await user.click(screen.getByRole('button', { name: /roast it/i }));

    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith({
        repo_url: 'https://github.com/kavya/todo-api',
        assignment_title: 'Week 3',
        roast_level: 'medium',
        roast_language: 'tanglish',
      }),
    );
    expect(await screen.findByText('Detail page reached')).toBeInTheDocument();
  });

  it('sends the chosen roast level and language and remembers them', async () => {
    const user = userEvent.setup();
    mocked.create.mockResolvedValue(makeSubmission({ id: 78, status: 'queued', latest_roast: null }));
    renderNewRoast();

    await user.click(screen.getByLabelText(/github repo url/i));
    await user.paste('https://github.com/kavya/todo-api');
    await user.click(screen.getByRole('radio', { name: /spicy/i }));
    await user.click(screen.getByRole('radio', { name: /^english/i }));
    await user.click(screen.getByRole('button', { name: /roast it/i }));

    await waitFor(() =>
      expect(mocked.create).toHaveBeenCalledWith({
        repo_url: 'https://github.com/kavya/todo-api',
        roast_level: 'spicy',
        roast_language: 'english',
      }),
    );
    expect(JSON.parse(window.localStorage.getItem('ar_roast_mode') ?? '{}')).toEqual({
      level: 'spicy',
      language: 'english',
    });
  });

  it('disables submit when the daily quota is used up', async () => {
    mocked.getQuota.mockResolvedValue({ used: 3, limit: 3, resets_at: '2026-10-11T00:00:00Z' });
    renderNewRoast();
    expect(await screen.findByText(/used all of today's roasts/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roast it/i })).toBeDisabled();
  });
});

function renderDetail(id = 42) {
  return renderWithProviders(
    <Routes>
      <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
    </Routes>,
    { route: `/submissions/${id}`, withAuth: false },
  );
}

describe('SubmissionDetailPage', () => {
  it('renders a completed roast', async () => {
    mocked.get.mockResolvedValue(makeSubmission());
    renderDetail();

    expect(await screen.findByRole('heading', { name: /tests enga/i })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: /overall score/i })).toHaveAttribute('aria-valuenow', '7.5');
    expect(screen.getByRole('meter', { name: 'Code Quality' })).toBeInTheDocument();
    expect(screen.getByText('Clean folder structure')).toBeInTheDocument();
    expect(screen.getByText('Hardcoded secret key')).toBeInTheDocument();
    const repoLink = screen.getByRole('link', { name: /kavya\/todo-api/i });
    expect(repoLink).toHaveAttribute('href', 'https://github.com/kavya/todo-api');
    expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: /re-roast/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByTestId('roast-mode')).toHaveTextContent('Medium · Tanglish');
  });

  it('copies the fixes as a markdown checklist', async () => {
    const user = userEvent.setup();
    mocked.get.mockResolvedValue(makeSubmission());
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /copy as checklist/i }));
    const copied = await navigator.clipboard.readText();
    expect(copied).toContain('## Fixes for kavya/todo-api');
    expect(copied).toContain('- [ ] **High** `app/main.py` (L10-L40): Hardcoded secret key');
    expect(await screen.findByText('Fixes copied')).toBeInTheDocument();
  });

  it('prints the report for PDF download with a descriptive title', async () => {
    const user = userEvent.setup();
    let titleDuringPrint = '';
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title;
    });
    mocked.get.mockResolvedValue(makeSubmission());
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /download pdf/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(titleDuringPrint).toBe('todo-api code review - Assignment Roaster');
    printSpy.mockRestore();
  });

  it('re-roasts with a different level and language from the dialog', async () => {
    const user = userEvent.setup();
    mocked.get.mockResolvedValue(makeSubmission());
    mocked.reroast.mockResolvedValue(
      makeSubmission({ status: 'queued', roast_level: 'lite', roast_language: 'tamil' }),
    );
    renderDetail();

    await user.click(await screen.findByRole('button', { name: /re-roast/i }));
    const dialog = await screen.findByRole('dialog', { name: /re-roast this repo/i });
    expect(dialog).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /lite/i }));
    await user.click(screen.getByRole('radio', { name: /^tamil/i }));
    await user.click(screen.getByRole('button', { name: /start re-roast/i }));

    await waitFor(() =>
      expect(mocked.reroast).toHaveBeenCalledWith(42, { roast_level: 'lite', roast_language: 'tamil' }),
    );
  });

  it('renders the failed state with error message and tailored tip', async () => {
    mocked.get.mockResolvedValue(
      makeSubmission({
        status: 'failed',
        latest_roast: null,
        error_code: 'repo_not_found_or_private',
        error_message: 'Repo kandupidikka mudiyala machaan — private ah irukka?',
      }),
    );
    renderDetail();

    expect(await screen.findByText(/repo kandupidikka mudiyala/i)).toBeInTheDocument();
    expect(screen.getByTestId('error-tip')).toHaveTextContent(/make the repo public on github/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /roast another repo/i })).toHaveAttribute('href', '/roast/new');
  });

  it('shows the stepper while processing', async () => {
    mocked.get.mockResolvedValue(makeSubmission({ status: 'analyzing', latest_roast: null }));
    renderDetail();
    expect(await screen.findByText('Roast status: Analyzing')).toBeInTheDocument();
  });
});
