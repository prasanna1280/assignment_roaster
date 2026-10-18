import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import { PageWrapper } from '../components/ui/PageWrapper';
import { SectionCard } from '../components/ui/SectionCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { RepoUrlInput } from '../components/roast/RepoUrlInput';
import { QuotaBadge } from '../components/roast/QuotaBadge';
import { isQuotaExhausted } from '../components/roast/roastUtils';
import { useCreateSubmission, useQuota } from '../hooks/useSubmissions';
import { RoastModePicker } from '../components/roast/RoastModePicker';
import { parseRepoUrl, validateRepoUrl } from '../lib/repoUrl';
import { loadRoastModePreference, saveRoastModePreference } from '../lib/roastModes';
import { getErrorCode, getErrorMessage } from '../services/api';
import type { RoastLanguage, RoastLevel, SubmissionCreate } from '../types';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 5000;
const BRANCH_MAX = 255;

export function NewRoastPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const quotaQuery = useQuota();
  const createSubmission = useCreateSubmission();

  const [repoUrl, setRepoUrl] = useState('');
  const [repoTouched, setRepoTouched] = useState(false);
  const [serverRepoError, setServerRepoError] = useState<string | null>(null);
  const [branch, setBranch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [level, setLevel] = useState<RoastLevel>(() => loadRoastModePreference().level);
  const [language, setLanguage] = useState<RoastLanguage>(() => loadRoastModePreference().language);

  const clientRepoError = validateRepoUrl(repoUrl);
  const repoError = serverRepoError ?? (repoTouched ? clientRepoError : null);
  const urlBranch = parseRepoUrl(repoUrl)?.branch ?? null;
  const quotaExhausted = isQuotaExhausted(quotaQuery.data);
  const isSubmitting = createSubmission.isPending;

  const handleSubmit = async (event: FormEvent<HTMLElement>) => {
    event.preventDefault();
    setRepoTouched(true);
    setFormError(null);
    if (clientRepoError || quotaExhausted) return;

    const payload: SubmissionCreate = { repo_url: repoUrl.trim(), roast_level: level, roast_language: language };
    saveRoastModePreference({ level, language });
    const trimmedBranch = branch.trim();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (trimmedBranch) payload.branch = trimmedBranch;
    if (trimmedTitle) payload.assignment_title = trimmedTitle;
    if (trimmedDescription) payload.assignment_description = trimmedDescription;

    try {
      const submission = await createSubmission.mutateAsync(payload);
      navigate(`/submissions/${submission.id}`);
    } catch (err) {
      const code = getErrorCode(err);
      const message = getErrorMessage(err);
      if (code === 'invalid_repo_url') {
        setServerRepoError(message);
        return;
      }
      if (code === 'daily_limit_reached') {
        void quotaQuery.refetch();
      }
      const displayMessage =
        code === 'rate_limited' ? `${message} Too many requests. Please wait a moment and try again.` : message;
      setFormError(displayMessage);
      toast({ status: 'error', title: 'Could not start the roast', description: message, isClosable: true });
    }
  };

  return (
    <PageWrapper maxW="container.md">
      <Stack spacing={8}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4} direction={{ base: 'column', md: 'row' }}>
          <Stack spacing={1}>
            <Heading as="h1" size="xl">
              New roast
            </Heading>
            <Text color="text.muted">Paste a public GitHub repo, choose a tone and language, and get a scored review.</Text>
          </Stack>
          <QuotaBadge quota={quotaQuery.data} isLoading={quotaQuery.isLoading} />
        </Flex>

        {quotaExhausted && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <AlertDescription>
              You've used all of today's roasts. Your quota resets at 00:00 UTC.
            </AlertDescription>
          </Alert>
        )}

        <SectionCard>
          <Stack as="form" spacing={6} onSubmit={(e) => void handleSubmit(e)} noValidate aria-label="New roast">
            <RepoUrlInput
              value={repoUrl}
              onChange={(value) => {
                setRepoUrl(value);
                setServerRepoError(null);
              }}
              onBlur={() => setRepoTouched(true)}
              error={repoError}
              isDisabled={isSubmitting}
            />

            <RoastModePicker
              level={level}
              language={language}
              onLevelChange={setLevel}
              onLanguageChange={setLanguage}
              isDisabled={isSubmitting}
            />

            <FormControl isDisabled={isSubmitting}>
              <FormLabel htmlFor="branch">Branch (optional)</FormLabel>
              <Input
                id="branch"
                name="branch"
                placeholder={urlBranch ?? 'main'}
                value={branch}
                maxLength={BRANCH_MAX}
                fontFamily="mono"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
              />
              <FormHelperText>
                {urlBranch
                  ? `Using "${urlBranch}" from the URL unless you type another branch.`
                  : 'Leave empty to roast the default branch.'}
              </FormHelperText>
            </FormControl>

            <FormControl isDisabled={isSubmitting} isInvalid={title.length > TITLE_MAX}>
              <FormLabel htmlFor="assignment-title">Assignment title (optional)</FormLabel>
              <Input
                id="assignment-title"
                name="assignment_title"
                placeholder="e.g. Week 3 — Todo API with FastAPI"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              />
              <FormErrorMessage>Title max {TITLE_MAX} characters.</FormErrorMessage>
            </FormControl>

            <FormControl isDisabled={isSubmitting} isInvalid={description.length > DESCRIPTION_MAX}>
              <FormLabel htmlFor="assignment-description">Assignment brief (optional)</FormLabel>
              <Textarea
                id="assignment-description"
                name="assignment_description"
                placeholder="Paste the assignment requirements so the roast checks what was actually asked."
                value={description}
                maxLength={DESCRIPTION_MAX}
                rows={6}
                aria-describedby="description-counter"
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              />
              <Flex justify="space-between">
                <FormHelperText>Adding the brief lets the review check the actual requirements.</FormHelperText>
                <FormHelperText id="description-counter" data-testid="description-counter">
                  {description.length} / {DESCRIPTION_MAX}
                </FormHelperText>
              </Flex>
            </FormControl>

            {formError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <PrimaryButton
              type="submit"
              size="lg"
              w="full"
              isLoading={isSubmitting}
              loadingText="Starting roast…"
              isDisabled={quotaExhausted}
            >
              Roast it
            </PrimaryButton>
          </Stack>
        </SectionCard>
      </Stack>
    </PageWrapper>
  );
}

export default NewRoastPage;
