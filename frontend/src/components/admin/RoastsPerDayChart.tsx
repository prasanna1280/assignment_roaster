import { Box, Flex, Stack, Text, Tooltip, VisuallyHidden } from '@chakra-ui/react';
import type { DailyRoastCount } from '../../types';

export interface RoastsPerDayChartProps {
  data: DailyRoastCount[];
}

const PLOT_HEIGHT = 140;

/** Short weekday label for a `YYYY-MM-DD` UTC day, e.g. "Mon". */
function weekday(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

/** Long label for tooltips and the table view, e.g. "Mon, Oct 12". */
function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Single-series column chart of roasts per UTC day. One brand hue, thin bars with
 * rounded data-ends on the baseline, a hover tooltip per bar and a visually hidden table.
 */
export function RoastsPerDayChart({ data }: RoastsPerDayChartProps) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = Math.max(...data.map((d) => d.count));

  return (
    <Stack spacing={2}>
      <Flex
        h={`${PLOT_HEIGHT}px`}
        align="flex-end"
        gap="2px"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        aria-hidden="true"
      >
        {data.map((d) => {
          const isPeak = d.count === peak && peak > 0;
          return (
            <Tooltip key={d.day} label={`${longDay(d.day)}: ${d.count} roast${d.count === 1 ? '' : 's'}`} hasArrow>
              <Flex flex={1} h="full" direction="column" justify="flex-end" align="center" cursor="default" role="group">
                {isPeak && (
                  <Text fontSize="xs" fontWeight="semibold" color="text.primary" mb={1}>
                    {d.count}
                  </Text>
                )}
                <Box
                  w="60%"
                  maxW="28px"
                  h={`${(d.count / max) * (PLOT_HEIGHT - 24)}px`}
                  minH={d.count > 0 ? '2px' : 0}
                  bg="accent.fg"
                  borderTopRadius="4px"
                  transition="opacity 0.15s"
                  _groupHover={{ opacity: 0.8 }}
                />
              </Flex>
            </Tooltip>
          );
        })}
      </Flex>
      <Flex gap="2px" aria-hidden="true">
        {data.map((d) => (
          <Text key={d.day} flex={1} textAlign="center" fontSize="xs" color="text.muted">
            {weekday(d.day)}
          </Text>
        ))}
      </Flex>
      <VisuallyHidden>
        <table>
          <caption>Roasts per day (UTC), last {data.length} days</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Roasts</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <td>{longDay(d.day)}</td>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </Stack>
  );
}

export default RoastsPerDayChart;
