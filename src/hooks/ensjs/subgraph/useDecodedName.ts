import { QueryFunctionContext, queryOptions, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import {
  getDecodedName,
  GetDecodedNameParameters,
  GetDecodedNameReturnType,
} from '@ensdomains/ensjs/subgraph'
import { checkIsDecrypted } from '@ensdomains/ensjs/utils'

import { useQueryOptions } from '@app/hooks/useQueryOptions'
import { ConfigWithEns, CreateQueryKey, PartialBy, QueryConfig } from '@app/types'
import { getIsCachedData } from '@app/utils/getIsCachedData'

type UseDecodedNameParameters = PartialBy<GetDecodedNameParameters, 'name'>

type UseDecodedNameReturnType = GetDecodedNameReturnType

type UseDecodedNameConfig = QueryConfig<UseDecodedNameReturnType, Error>

type QueryKey<TParams extends UseDecodedNameParameters> = CreateQueryKey<
  TParams,
  'getDecodedName',
  'graph'
>

export const getDecodedNameQueryFn =
  (config: ConfigWithEns) =>
  async <TParams extends UseDecodedNameParameters>({
    queryKey: [{ name, ...params }, chainId],
  }: QueryFunctionContext<QueryKey<TParams>>) => {
    if (!name) throw new Error('name is required')

    const client = config.getClient({ chainId })

    return getDecodedName(client, { name, ...params })
  }

export const useDecodedName = <TParams extends UseDecodedNameParameters>({
  // config
  gcTime = 1_000 * 60 * 60 * 24,
  enabled = true,
  staleTime = 1_000 * 60 * 5,
  scopeKey,
  // params
  ...params
}: TParams & UseDecodedNameConfig) => {
  const initialOptions = useQueryOptions({
    params,
    scopeKey,
    functionName: 'getDecodedName',
    queryDependencyType: 'graph',
    queryFn: getDecodedNameQueryFn,
  })

  const nameIsEncrypted = useMemo(
    () => (params.name ? !checkIsDecrypted(params.name) : false),
    [params.name],
  )

  const preparedOptions = queryOptions({
    queryKey: initialOptions.queryKey,
    queryFn: initialOptions.queryFn,
    enabled: enabled && !!params.name && nameIsEncrypted,
  })

  const query = useQuery({
    ...preparedOptions,
    gcTime,
    staleTime,
  })

  return {
    ...query,
    refetchIfEnabled: preparedOptions.enabled ? query.refetch : () => {},
    isCachedData: getIsCachedData(query),
  }
}
