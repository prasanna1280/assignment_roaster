import { useRef } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Button,
  Center,
  Flex,
  Heading,
  HStack,
  Icon,
  Link,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  Text,
  useColorMode,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import {
  FiClipboard,
  FiDownload,
  FiExternalLink,
  FiGitBranch,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi';
import { PageWrapper } from '../components/ui/PageWrapper';
import { SectionCard } from '../components/ui/SectionCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { ScoreRing } from '../components/roast/ScoreRing';
import { CategoryBars } from '../components/roast/CategoryBars';
import { RoastHeadline } from '../components/roast/RoastHeadline';
import { RoastMarkdown } from '../components/roast/RoastMarkdown';
import { StrengthsList } from '../components/roast/StrengthsList';
import { FixList } from '../components/roast/FixList';
import { StatusStepper } from '../components/roast/StatusStepper';
import { StatusBadge } from '../components/roast/StatusBadge';
import { SubmissionErrorState } from '../components/roast/SubmissionErrorState';
import { fixesToMarkdown, formatRelativeDate, scoreVerdict } from '../components/roast/roastUtils';
import { ReroastDialog } from '../components/roast/ReroastDialog';
import { useDeleteSubmission, useReroast, useSubmission } from '../hooks/useSubmissions';
import {
  allowPrintBreak,
  hideWhenPrinting,
  rowWhenPrinting,
  showOnlyWhenPrinting,
  twoColumnsWhenPrinting,
} from '../lib/print';
import { roastLanguageLabel, roastLevelLabel } from '../lib/roastModes';
import { touchTarget } from '../lib/touch';
import { getErrorMessage } from '../services/api';
import type { ReroastOptions, Roast, Submission } from '../types';

function NotFoundState() {
  return (
    <SectionCard textAlign="center" py={12}>
      <Stack spacing={4} align="center">
        <Icon as={FiSearch} boxSize={10} color="text.muted" aria-hidden="true" />
        <Heading as="h1" size="lg">
          Roast not found
        </Heading>
        <Text color="text.muted" maxW="md">
          This submission doesn&apos;t exist or isn&apos;t yours. Maybe it was deleted?
        </Text>
        <HStack spacing={3}>
          <Button as={RouterLink} to="/submissions" variant="outline">
            My roasts
          </Button>
          <PrimaryButton to="/roast/new">Roast a repo</PrimaryButton>
        </HStack>
      </Stack>
    </SectionCard>
  );
}

function RepoHeader({ submission }: { submission: Submission }) {
  const repoName = `${submission.repo_owner}/${submission.repo_name}`;
  return (
    <Stack spacing={2}>
      <HStack spacing={3} flexWrap="wrap">
        <StatusBadge status={submission.status} />
        <Badge variant="outline" px={2} data-testid="roast-mode">
          {roastLevelLabel(submission.roast_level)} · {roastLanguageLabel(submission.roast_language)}
        </Badge>
        {submission.primary_language && (
          <Badge variant="subtle" px={2}>
            {submission.primary_language}
          </Badge>
        )}
        <Text as="time" dateTime={submission.created_at} fontSize="sm" color="text.muted">
          {formatRelativeDate(submission.created_at)}
        </Text>
      </HStack>
      <Heading as="h1" size="lg" wordBreak="break-word">
        {submission.assignment_title ?? repoName}
      </Heading>
      <HStack spacing={4} color="text.muted" fontSize="sm" flexWrap="wrap">
        <Link
          href={submission.repo_url}
          isExternal
          rel="noopener noreferrer"
          color="accent.fg"
          fontFamily="mono"
          sx={touchTarget}
          display="inline-flex"
          alignItems="center"
          gap={1}
        >
          {repoName}
          <Icon as={FiExternalLink} aria-hidden="true" />
          <Text as="span" srOnly>
            (opens in a new tab)
          </Text>
        </Link>
        {submission.branch && (
          <HStack spacing={1}>
            <Icon as={FiGitBranch} aria-hidden="true" />
            <Text as="span" fontFamily="mono">
              {submission.branch}
            </Text>
          </HStack>
        )}
        {submission.files_analyzed > 0 && <Text as="span">{submission.files_analyzed} files analyzed</Text>}
      </HStack>
    </Stack>
  );
}

interface CompletedRoastProps {
  roast: Roast;
  onCopyFixes: () => void;
}

function CompletedRoast({ roast, onCopyFixes }: CompletedRoastProps) {
  return (
    <Stack spacing={6}>
      <SectionCard>
        <Flex direction={{ base: 'column', md: 'row' }} gap={8} align="center" sx={rowWhenPrinting}>
          <Stack align="center" spacing={2}>
            <ScoreRing score={roast.overall_score} />
            <Text fontSize="sm" color="text.muted" textAlign="center">
              {scoreVerdict(roast.overall_score)}
            </Text>
          </Stack>
          <Stack spacing={4} flex="1">
            <RoastHeadline headline={roast.headline} />
          </Stack>
        </Flex>
      </SectionCard>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} sx={twoColumnsWhenPrinting}>
        <SectionCard>
          <Heading as="h2" size="md" mb={5}>
            Category scores
          </Heading>
          <CategoryBars scores={roast.category_scores} />
        </SectionCard>
        <SectionCard>
          <Heading as="h2" size="md" mb={5}>
            Strengths
          </Heading>
          <StrengthsList strengths={roast.strengths} />
        </SectionCard>
      </SimpleGrid>

      <SectionCard sx={allowPrintBreak}>
        <Heading as="h2" size="md" mb={5}>
          The roast
        </Heading>
        <RoastMarkdown content={roast.roast_text} />
      </SectionCard>

      <SectionCard sx={allowPrintBreak}>
        <Flex justify="space-between" align="center" gap={3} mb={5} flexWrap="wrap">
          <Heading as="h2" size="md">
            Fixes, by priority
          </Heading>
          <Button
            size="sm"
            variant="outline"
            colorScheme="gray"
            leftIcon={<FiClipboard aria-hidden="true" />}
            onClick={onCopyFixes}
            sx={hideWhenPrinting}
          >
            Copy as checklist
          </Button>
        </Flex>
        <FixList improvements={roast.improvements} />
      </SectionCard>
    </Stack>
  );
}

export function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0;
  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode, setColorMode } = useColorMode();
  const deleteDialog = useDisclosure();
  const reroastDialog = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const query = useSubmission(validId ? id : undefined);
  const reroast = useReroast();
  const deleteSubmission = useDeleteSubmission();

  const handleReroast = async (options?: ReroastOptions) => {
    try {
      await reroast.mutateAsync({ id, options });
      reroastDialog.onClose();
      toast({ status: 'info', title: 'Re-roast started', description: 'A fresh review is on the way.', isClosable: true });
    } catch (err) {
      toast({ status: 'error', title: 'Could not start the re-roast', description: getErrorMessage(err), isClosable: true });
    }
  };

  const handleCopyFixes = async (submission: Submission, roast: Roast) => {
    const repoName = `${submission.repo_owner}/${submission.repo_name}`;
    try {
      await navigator.clipboard.writeText(fixesToMarkdown(roast.improvements, repoName));
      toast({
        status: 'success',
        title: 'Fixes copied',
        description: 'Paste them into a GitHub issue or your notes.',
        isClosable: true,
      });
    } catch {
      toast({ status: 'error', title: 'Could not copy', description: 'Your browser blocked clipboard access.', isClosable: true });
    }
  };

  const handleDownloadPdf = (submission: Submission) => {
    // The browser suggests the document title as the PDF file name.
    const previousTitle = document.title;
    const wasDark = colorMode === 'dark';
    const printReport = () => {
      document.title = `${submission.repo_name} code review - Assignment Roaster`;
      window.print();
      document.title = previousTitle;
      if (wasDark) setColorMode('dark');
    };
    if (wasDark) {
      // Reports always print on a light background; switch back once the dialog closes.
      setColorMode('light');
      window.setTimeout(printReport, 150);
    } else {
      printReport();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSubmission.mutateAsync(id);
      deleteDialog.onClose();
      toast({ status: 'success', title: 'Roast deleted', isClosable: true });
      navigate('/submissions', { replace: true });
    } catch (err) {
      toast({ status: 'error', title: 'Could not delete', description: getErrorMessage(err), isClosable: true });
    }
  };

  if (!validId) {
    return (
      <PageWrapper>
        <NotFoundState />
      </PageWrapper>
    );
  }

  if (query.isLoading) {
    return (
      <PageWrapper>
        <Stack spacing={6} aria-busy="true">
          <Skeleton h="40px" w="60%" borderRadius="md" />
          <Skeleton h="200px" borderRadius="lg" />
          <Center>
            <Spinner color="accent.fg" label="Loading roast" />
          </Center>
        </Stack>
      </PageWrapper>
    );
  }

  if (query.isError || !query.data) {
    const is404 = axios.isAxiosError(query.error) && query.error.response?.status === 404;
    return (
      <PageWrapper>
        {is404 ? (
          <NotFoundState />
        ) : (
          <SectionCard role="alert">
            <Stack spacing={4} align="flex-start">
              <Heading as="h1" size="md">
                Could not load this roast
              </Heading>
              <Text color="text.muted">{getErrorMessage(query.error)}</Text>
              <Button leftIcon={<FiRefreshCw aria-hidden="true" />} onClick={() => void query.refetch()}>
                Try again
              </Button>
            </Stack>
          </SectionCard>
        )}
      </PageWrapper>
    );
  }

  const submission = query.data;
  const isProcessing = submission.status !== 'completed' && submission.status !== 'failed';
  const roast = submission.latest_roast;

  return (
    <PageWrapper maxW="container.xl">
      <Stack spacing={8}>
        <Flex sx={showOnlyWhenPrinting} justify="space-between" borderBottomWidth="1px" borderColor="border.subtle" pb={3}>
          <Text fontWeight="semibold">Assignment Roaster · Code review report</Text>
          <Text color="text.muted">{new Date().toLocaleDateString()}</Text>
        </Flex>
        <Flex justify="space-between" gap={4} direction={{ base: 'column', md: 'row' }} align={{ md: 'flex-end' }}>
          <RepoHeader submission={submission} />
          {!isProcessing && (
            <HStack spacing={3} flexWrap="wrap" sx={hideWhenPrinting}>
              {submission.status === 'completed' && roast && (
                <Button
                  leftIcon={<FiDownload aria-hidden="true" />}
                  variant="outline"
                  colorScheme="gray"
                  onClick={() => handleDownloadPdf(submission)}
                >
                  Download PDF
                </Button>
              )}
              <Button
                leftIcon={<FiRefreshCw aria-hidden="true" />}
                variant="outline"
                onClick={reroastDialog.onOpen}
                isLoading={reroast.isPending}
                loadingText="Re-roasting"
              >
                Re-roast
              </Button>
              <Button
                leftIcon={<FiTrash2 aria-hidden="true" />}
                variant="ghost"
                colorScheme="red"
                onClick={deleteDialog.onOpen}
              >
                Delete
              </Button>
              <PrimaryButton to="/roast/new">Roast another</PrimaryButton>
            </HStack>
          )}
        </Flex>

        {isProcessing && (
          <SectionCard py={10}>
            <StatusStepper status={submission.status} />
          </SectionCard>
        )}

        {submission.status === 'failed' && (
          <SubmissionErrorState
            errorCode={submission.error_code}
            errorMessage={submission.error_message}
            onRetry={() => void handleReroast()}
            isRetrying={reroast.isPending}
          />
        )}

        {submission.status === 'completed' &&
          (roast ? (
            <CompletedRoast roast={roast} onCopyFixes={() => void handleCopyFixes(submission, roast)} />
          ) : (
            <SubmissionErrorState
              errorCode="internal_error"
              errorMessage="Roast completed, but the result went missing. Please re-roast."
              onRetry={() => void handleReroast()}
              isRetrying={reroast.isPending}
            />
          ))}
      </Stack>

      <ReroastDialog
        key={`${submission.roast_level}-${submission.roast_language}`}
        isOpen={reroastDialog.isOpen}
        onClose={reroastDialog.onClose}
        initialLevel={submission.roast_level}
        initialLanguage={submission.roast_language}
        onConfirm={(options) => void handleReroast(options)}
        isLoading={reroast.isPending}
      />

      <AlertDialog isOpen={deleteDialog.isOpen} leastDestructiveRef={cancelRef} onClose={deleteDialog.onClose} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent bg="bg.surface">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete this roast?
            </AlertDialogHeader>
            <AlertDialogBody>
              This permanently deletes the submission and all of its roasts.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={deleteDialog.onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                onClick={() => void handleDelete()}
                isLoading={deleteSubmission.isPending}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </PageWrapper>
  );
}

export default SubmissionDetailPage;
