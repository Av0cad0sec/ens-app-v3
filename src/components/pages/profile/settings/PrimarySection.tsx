import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { Button, Typography } from '@ensdomains/thorin'

import { TaggedNameItem } from '@app/components/@atoms/NameDetailItem/TaggedNameItem'
import { DisabledButtonWithTooltip } from '@app/components/@molecules/DisabledButtonWithTooltip'
import { useHasGlobalError } from '@app/hooks/errors/useHasGlobalError'
import { useAccountSafely } from '@app/hooks/useAccountSafely'
import { useBasicName } from '@app/hooks/useBasicName'
import { useChainId } from '@app/hooks/useChainId'
import { usePrimary } from '@app/hooks/usePrimary'
import { useSelfAbilities } from '@app/hooks/useSelfAbilities'
import { useTransactionFlow } from '@app/transaction-flow/TransactionFlowProvider'

import { SectionContainer } from './Section'

const ItemWrapper = styled.div(
  ({ theme }) => css`
    width: ${theme.space.full};
    background-color: ${theme.colors.background};
  `,
)

export const PrimarySection = () => {
  const { t } = useTranslation('settings')

  const { prepareDataInput } = useTransactionFlow()
  const showSelectPrimaryNameInput = prepareDataInput('SelectPrimaryName')

  const chainId = useChainId()

  const { address: _address } = useAccountSafely()
  const address = _address as string

  const { name, loading: primaryLoading } = usePrimary(address, !address)

  const {
    expiryDate,
    truncatedName,
    isLoading: basicLoading,
    wrapperData,
  } = useBasicName(name, { normalised: true, skipGraph: false })

  const { canSendOwner, canSendManager } = useSelfAbilities(address, name)

  const hasGlobalError = useHasGlobalError()

  const isLoading = basicLoading || primaryLoading

  const changePrimary = () =>
    showSelectPrimaryNameInput(`changePrimary-${address}`, {
      address,
      existingPrimary: name,
    })

  return (
    <SectionContainer
      title={t('section.primary.title')}
      action={
        hasGlobalError ? (
          <DisabledButtonWithTooltip
            buttonId="disabled-primary-section-button"
            content={t('errors.networkError.blurb', { ns: 'common' })}
            buttonText={t(`action.${name ? 'change' : 'set'}`, { ns: 'common' })}
          />
        ) : (
          <Button data-testid="primary-section-button" size="small" onClick={() => changePrimary()}>
            {t(`action.${name ? 'change' : 'set'}`, { ns: 'common' })}
          </Button>
        )
      }
      fill={!!name}
    >
      {name ? (
        <ItemWrapper data-testid="primary-wrapper">
          <TaggedNameItem
            name={name}
            network={chainId}
            expiryDate={expiryDate || undefined}
            isController={canSendManager}
            isRegistrant={canSendOwner}
            truncatedName={truncatedName}
            fuses={wrapperData}
          />
        </ItemWrapper>
      ) : (
        <Typography data-testid="primary-section-text" fontVariant="bodyBold" color="grey">
          {isLoading ? t('section.primary.loading') : t('section.primary.noName')}
        </Typography>
      )}
    </SectionContainer>
  )
}
