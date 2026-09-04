import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Button, Image, List, Paper, Stack, Text, Title } from '@mantine/core'
import { NeuButton } from 'neumorphic-ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdaptiveModal } from '@/components/common/AdaptiveModal'
import { NeoPressable, NeoRise } from '@/components/ui/NeoMotion'
import icon from '../static/icon.png'
import { navigateToSettings } from './settings-navigation'

const Welcome = NiceModal.create(() => {
  const { t } = useTranslation()
  const modal = useModal()

  // interaction state for the neumorphic-ui NeuButton CTA
  const [neuHovered, setNeuHovered] = useState(false)
  const [neuClicked, setNeuClicked] = useState(false)

  const onClose = () => {
    modal.resolve()
    modal.hide()
  }

  const onSetupProvider = () => {
    navigateToSettings('/provider/fibonacci')
    modal.resolve('setup')
    modal.hide()
  }

  return (
    <AdaptiveModal
      opened={modal.visible}
      onClose={onClose}
      withCloseButton={false}
      centered={true}
      radius="lg"
      classNames={{
        body: 'pt-xxl px-xl pb-md',
      }}
    >
      <NeoRise>
        <Stack gap="xl">
          <Stack gap="md" align="center">
            <Stack gap="sm" align="center">
              <Image src={icon} w={86} h={86} />
              <Stack gap="3xs" align="center">
                <Title order={3}>Fibonacci Chat Area</Title>
                <Text size="md">{t('An easy-to-use AI client app')}</Text>
              </Stack>
            </Stack>

            <List size="sm" c="chatbox-secondary" className="flex flex-col items-center">
              <List.Item>{t('Supports a variety of advanced AI models')}</List.Item>
              <List.Item>{t('All data is stored locally, ensuring privacy and rapid access')}</List.Item>
              <List.Item>{t('Ideal for both work and educational scenarios')}</List.Item>
            </List>
          </Stack>

          <Paper shadow="none" radius="lg" withBorder p="lg" className="neo-well">
            <Stack gap="sm">
              <Text className="text-center">{t('Select and configure an AI model provider')}</Text>
              {/* CTA: NeuButton from neumorphic-ui (awesome-neumorphism), restyled by the
                  fusion layer to follow the app's soft-UI tokens in light & dark themes.
                  Motion's NeoPressable adds the spring press micro-interaction. */}
              <NeoPressable className="w-full">
                <div
                  className="neo-neu-btn-host"
                  onPointerDown={() => setNeuClicked(true)}
                  onPointerUp={() => setNeuClicked(false)}
                  onPointerLeave={() => setNeuClicked(false)}
                >
                  <NeuButton
                    text={t('Setup Provider')}
                    hovered={neuHovered}
                    clicked={neuClicked}
                    mouseOver={() => setNeuHovered(true)}
                    mouseOut={() => setNeuHovered(false)}
                    onClick={onSetupProvider}
                  />
                </div>
              </NeoPressable>
            </Stack>
          </Paper>

          <Button variant="transparent" c="chatbox-secondary" size="compact-md" onClick={onClose}>
            {t('Setup later')}
          </Button>
        </Stack>
      </NeoRise>
    </AdaptiveModal>
  )
})

export default Welcome
