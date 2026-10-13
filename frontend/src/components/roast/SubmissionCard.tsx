import { Link as RouterLink } from 'react-router-dom';
import { Box, Flex, HStack, Icon, LinkBox, LinkOverlay, Stack, Text } from '@chakra-ui/react';
import { FiGitBranch, FiGithub } from 'react-icons/fi';
import type { Submission } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { ScoreRing } from './ScoreRing';
import { StatusBadge } from './StatusBadge';
import { formatRelativeDate } from './roastUtils';

export interface SubmissionCardProps {
  submission: Submission;
}

export function SubmissionCard({ submission }: SubmissionCardProps) {
  const roast = submission.latest_roast;
  const showScore = submission.status === 'completed' && roast !== null;
  const repoName = `${submission.repo_owner}/${submission.repo_name}`;

  return (
    <LinkBox as="article" data-testid="submission-card">
      <GlassCard p={5}>
        <Flex gap={4} align="center">
          <Stack spacing={1.5} flex="1" minW={0}>
            <HStack spacing={2} minW={0}>
              <Icon as={FiGithub} color="text.muted" aria-hidden="true" flexShrink={0} />
              <LinkOverlay as={RouterLink} to={`/submissions/${submission.id}`} fontWeight="semibold" noOfLines={1}>
                {repoName}
              </LinkOverlay>
            </HStack>
            {submission.assignment_title && (
              <Text color="text.muted" noOfLines={1}>
                {submission.assignment_title}
              </Text>
            )}
            <HStack spacing={3} fontSize="sm" color="text.muted" flexWrap="wrap">
              <StatusBadge status={submission.status} />
              {submission.branch && (
                <HStack spacing={1}>
                  <Icon as={FiGitBranch} aria-hidden="true" />
                  <Text as="span" fontFamily="mono">
                    {submission.branch}
                  </Text>
                </HStack>
              )}
              <Text as="time" dateTime={submission.created_at}>
                {formatRelativeDate(submission.created_at)}
              </Text>
            </HStack>
          </Stack>
          {showScore && roast ? (
            <ScoreRing score={roast.overall_score} size={64} thickness={6} label={`Score for ${repoName}`} />
          ) : (
            <Box w="64px" textAlign="center" color="text.muted" fontSize="2xl" aria-hidden="true">
              {submission.status === 'failed' ? '💥' : '🔥'}
            </Box>
          )}
        </Flex>
      </GlassCard>
    </LinkBox>
  );
}

export default SubmissionCard;
