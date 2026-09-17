import { Button, Flex, Paper, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { navigateToSettings } from '@/modals/settings-navigation'
import platform from '@/platform'
import type { HomeWelcomeCardMode } from '@/utils/homeWelcomeCard'

/**
 * Welcome card shown on the home screen when no AI provider is configured yet.
 * Fibonacci fork: guides the user to create an API token at
 * my.fibonacci.monster/user/api-tokens and paste it into the Fibonacci AI provider.
 */
export function ChatboxWelcomeCard(props: { mode: HomeWelcomeCardMode; pageName: string; className?: string }) {
  const { mode, className } = props
  const { t } = useTranslation()

  if (mode === 'none') {
    return null
  }

  return (
    <Paper
      radius="lg"
      withBorder
      py="md"
      px="sm"
      className={`bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md ${className || ''}`}
    >
      <Stack gap="sm">
        <Stack gap="xxs" align="center">
          <Text fw={600} className="text-center">
            {t('Welcome to Chatbox!')}
          </Text>

          <Text size="xs" c="chatbox-tertiary" className="text-center">
            {t('Add your Fibonacci AI API token to start chatting')}
          </Text>
        </Stack>

        <Flex gap="xs" justify="center" align="center" wrap="wrap">
          <Button
            size="xs"
            variant="filled"
            h={32}
            miw={160}
            fw={600}
            flex="0 1 auto"
            onClick={() => navigateToSettings('provider/fibonacci')}
          >
            {t('Add API Token')}
          </Button>
          <Button
            size="xs"
            variant="subtle"
            c="chatbox-tertiary"
            h={32}
            fw={400}
            flex="0 1 auto"
            onClick={() => platform.openLink('https://my.fibonacci.monster/user/api-tokens')}
          >
            {t('Get API Token')}
          </Button>
        </Flex>
      </Stack>
    </Paper>
  )
}
