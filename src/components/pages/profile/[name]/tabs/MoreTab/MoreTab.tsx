import styled, { css } from 'styled-components'
import { useAccount } from 'wagmi'

import { CacheableComponent } from '@app/components/@atoms/CacheableComponent'
import type { useAbilities } from '@app/hooks/abilities/useAbilities'
import { useNameDetails } from '@app/hooks/useNameDetails'

import { NameWrapper } from './NameWrapper'
import Resolver from './Resolver'
import Token from './Token/Token'

const MoreContainer = styled(CacheableComponent)(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    width: 100%;

    gap: ${theme.space['4']};
  `,
)

type Props = {
  name: string
  nameDetails: ReturnType<typeof useNameDetails>
  abilities: ReturnType<typeof useAbilities>['data']
}

const MoreTab = ({ name, nameDetails, abilities }: Props) => {
  const { canBeWrapped, ownerData, wrapperData, isWrapped, isCachedData, profile } = nameDetails
  const { isConnected } = useAccount()

  return (
    <MoreContainer>
      {ownerData && <Token isWrapped={isWrapped} name={name} />}
      <Resolver
        name={name}
        canEdit={abilities.canEdit}
        canEditResolver={abilities.canEditResolver}
        isCachedData={isCachedData}
        resolverAddress={profile?.resolverAddress}
        canEditResolverError={abilities.canEditResolverError}
      />
      {isConnected && <NameWrapper {...{ isWrapped, wrapperData, canBeWrapped, name, profile }} />}
    </MoreContainer>
  )
}

export default MoreTab
