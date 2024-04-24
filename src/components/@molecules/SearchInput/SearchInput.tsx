import debounce from 'lodash/debounce'
import {
  Dispatch,
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import useTransition, { TransitionState } from 'react-transition-state'
import styled, { css } from 'styled-components'
import { isAddress } from 'viem'

import { BackdropSurface, mq, Portal, Typography } from '@ensdomains/thorin'

import { useLocalStorage } from '@app/hooks/useLocalStorage'
import { useRouterWithHistory } from '@app/hooks/useRouterWithHistory'
import { useValidate } from '@app/hooks/useValidate'
import { useElementSize } from '@app/hooks/useWindowSize'
import { useBreakpoint } from '@app/utils/BreakpointProvider'
import { thread } from '@app/utils/utils'

import { FakeSearchInputBox, SearchInputBox } from './SearchInputBox'
import { SearchResult } from './SearchResult'
import { AnyItem, HistoryItem, SearchHandler, SearchItem } from './types'

const Container = styled.div<{ $size: 'medium' | 'extraLarge' }>(
  ({ $size }) => css`
    width: 100%;
    position: relative;
    ${$size === 'extraLarge' &&
    mq.sm.min(css`
      padding-left: 48px;
      padding-right: 48px;
    `)}
  `,
)

const SearchResultsContainer = styled.div<{
  $state: TransitionState
}>(
  ({ theme, $state }) => css`
    position: absolute;
    width: 100%;
    height: min-content;
    top: calc(100% + ${theme.space['3']});

    background-color: #f7f7f7;
    box-shadow: 0 2px 12px ${theme.colors.border};
    border-radius: ${theme.radii.extraLarge};
    border: ${theme.borderWidths.px} ${theme.borderStyles.solid} ${theme.colors.border};
    &[data-error='true'] {
      border-color: ${theme.colors.red};
    }

    overflow: hidden;

    opacity: 0;
    z-index: 1000;
    transform: translateY(-${theme.space['2']});
    transition:
      0.35s all cubic-bezier(1, 0, 0.22, 1.6),
      0s border-color linear 0s,
      0s width linear 0s;

    ${$state === 'entered'
      ? css`
          opacity: 1;
          transform: translateY(0px);
        `
      : css`
          & > div {
            cursor: default;
          }
        `}
  `,
)

const FloatingSearchContainer = styled.div<{ $state: TransitionState }>(
  ({ theme, $state }) => css`
    width: 95%;

    position: fixed;
    left: 2.5%;
    z-index: 9999;
    top: ${theme.space['4']};

    display: flex;
    flex-direction: column;

    opacity: 0;

    & > div:nth-child(2) {
      width: 95vw !important;
    }

    ${$state === 'entered' &&
    css`
      opacity: 1;
    `}
  `,
)

const InputAndCancel = styled.div(
  () => css`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  `,
)

const CancelButton = styled(Typography)(
  ({ theme }) => css`
    padding: ${theme.space['3']};
  `,
)

const MobileSearchInput = ({
  state,
  toggle,
  searchInputRef,
  SearchResultsElement,
  SearchInputElement,
}: {
  state: TransitionState
  toggle: (value: boolean) => void
  searchInputRef: RefObject<HTMLInputElement>
  SearchResultsElement: JSX.Element
  SearchInputElement: JSX.Element
}) => {
  const { t } = useTranslation('common')

  useEffect(() => {
    if (state === 'entered') {
      searchInputRef.current?.focus()
    }
  }, [searchInputRef, state])

  return (
    <>
      <FakeSearchInputBox
        onClick={(e) => {
          toggle(true)
          // MOBILE SAFARI FIX:
          // focus on the fake input first, then wait for the transition to finish and focus on the real input
          // this allows the keyboard to pop up
          e.currentTarget.focus()
          e.preventDefault()
          setTimeout(() => searchInputRef.current?.focus(), 350)
        }}
      />
      {state !== 'unmounted' && (
        <Portal>
          <BackdropSurface
            $empty={false}
            onClick={() => toggle(false)}
            $state={state}
            data-testid="search-input-backdrop"
          />
          <FloatingSearchContainer $state={state}>
            <InputAndCancel>
              {SearchInputElement}
              <CancelButton as="button" onClick={() => toggle(false)}>
                {t('action.cancel')}
              </CancelButton>
            </InputAndCancel>
            {SearchResultsElement}
          </FloatingSearchContainer>
        </Portal>
      )}
    </>
  )
}

const createSearchHandler =
  ({
    router,
    setHistory,
    dropdownItems,
  }: {
    router: ReturnType<typeof useRouterWithHistory>
    setHistory: Dispatch<SetStateAction<HistoryItem[]>>
    dropdownItems: SearchItem[]
  }): SearchHandler =>
  (index: number) => {
    if (index === -1) return
    const searchItem = dropdownItems[index]
    if (!searchItem?.text) return
    const { text, nameType } = searchItem
    if (nameType === 'error' || nameType === 'text') return
    setHistory((prev: HistoryItem[]) => [
      ...prev.filter((item) => !(item.text === text && item.nameType === nameType)),
      { lastAccessed: Date.now(), nameType, text, isValid: searchItem.isValid },
    ])
    router.push(`/${text}`)
  }

const useAddEventListeners = ({
  searchInputRef,
  handleKeyDown,
  handleFocusIn,
  handleFocusOut,
}: {
  searchInputRef: RefObject<HTMLInputElement>
  handleKeyDown: (e: KeyboardEvent) => void
  handleFocusIn: (e: FocusEvent) => void
  handleFocusOut: (e: FocusEvent) => void
}) => {
  useEffect(() => {
    const searchInput = searchInputRef.current
    if (searchInput) {
      searchInput?.addEventListener('keydown', handleKeyDown)
      searchInput?.addEventListener('focusin', handleFocusIn)
      searchInput?.addEventListener('focusout', handleFocusOut)
      return () => {
        searchInput?.removeEventListener('keydown', handleKeyDown)
        searchInput?.removeEventListener('focusin', handleFocusIn)
        searchInput?.removeEventListener('focusout', handleFocusOut)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleFocusIn, handleFocusOut, handleKeyDown, searchInputRef.current])
}

const handleKeyDown =
  ({
    dropdownItems,
    handleSearch,
    selected,
    setSelected,
  }: {
    dropdownItems: SearchItem[]
    handleSearch: SearchHandler
    selected: number
    setSelected: Dispatch<SetStateAction<number>>
  }) =>
  (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(selected)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((prev: number) => (prev - 1 + dropdownItems.length) % dropdownItems.length)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((prev: number) => (prev + 1) % dropdownItems.length)
    }
  }

const useSelectionManager = ({
  inputVal,
  setSelected,
  state,
}: {
  inputVal: string
  setSelected: Dispatch<SetStateAction<number>>
  state: TransitionState
}) => {
  useEffect(() => {
    if (inputVal === '') {
      setSelected(-1)
    } else {
      setSelected(0)
    }
  }, [inputVal, setSelected])

  useEffect(() => {
    if (state === 'unmounted') {
      setSelected(-1)
    }
  }, [state, setSelected])
}

const formatEthText = ({ name, isETH }: { name: string; isETH: boolean | undefined }) => {
  if (!name) return ''
  if (isETH) return name
  if (name.includes('.')) return ''
  return `${name}.eth`
}
const addEthDropdownItem =
  ({ name, isETH }: { name: string; isETH: boolean | undefined }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    const formattedEthName = formatEthText({ name, isETH })
    if (formattedEthName === '') return dropdownItems
    return [
      {
        text: formattedEthName,
        nameType: 'eth',
      } as const,
      ...dropdownItems,
    ]
  }

const isBoxValid = (name: string) => {
  /*
    This regular expression will match any string that starts and ends with a letter or a digit, 
    does not have a hyphen in the third or fourth position, does not include a space, and 
    consists only of the characters a-z, A-Z, 0-9, and - in between, but does not start or end 
    with a hyphen.

    This is to comply with .box name rules. 
  */
  const regex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/

  if (!name.endsWith('.box')) return false
  if (name.length > 63) return false
  if (!regex.test(name.slice(0, -4))) return false
  return true
}
const formatBoxText = (name: string) => {
  if (!name) return ''
  if (name?.endsWith('.box')) return name
  if (name.includes('.')) return ''
  return `${name}.box`
}
const addBoxDropdownItem =
  ({ name, isValid }: { name: string; isValid: boolean | undefined }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    const formattedBoxName = formatBoxText(name)
    if (!formattedBoxName) return dropdownItems
    return [
      ...dropdownItems,
      {
        text: formattedBoxName,
        nameType: 'box',
        isValid: isValid && isBoxValid(formattedBoxName),
      } as const,
    ]
  }

const formatTldText = (name: string) => {
  if (!name) return ''
  if (name.includes('.')) return ''
  return name
}
const addTldDropdownItem =
  ({ name }: { name: string }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    const formattedTld = formatTldText(name)
    if (!formattedTld) return dropdownItems
    return [
      ...dropdownItems,
      {
        text: formattedTld,
        nameType: 'tld',
      } as const,
    ]
  }

const addAddressItem =
  ({ name, inputIsAddress }: { name: string; inputIsAddress: boolean }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    if (!inputIsAddress) return dropdownItems
    return [
      {
        text: name,
        nameType: 'address',
      } as const,
      ...dropdownItems,
    ]
  }

const MAX_DROPDOWN_ITEMS = 6
const addHistoryDropdownItems =
  ({ name, history }: { name: string; history: HistoryItem[] }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    const historyItemDrawCount = MAX_DROPDOWN_ITEMS - dropdownItems.length

    if (historyItemDrawCount > 0) {
      const filteredHistoryItems = history
        .filter(
          (historyItem: HistoryItem) =>
            historyItem.text.includes(name) &&
            dropdownItems.findIndex(
              (dropdownItem) =>
                dropdownItem.nameType === historyItem.nameType &&
                dropdownItem.text === historyItem.text,
            ) === -1,
        )
        .sort((a, b) => b.lastAccessed - a.lastAccessed)
      const historyItems = filteredHistoryItems?.slice(0, historyItemDrawCount).map((item) => ({
        nameType: item.nameType,
        text: item.text,
        isHistory: true,
      }))
      return [...dropdownItems, ...historyItems]
    }

    return dropdownItems
  }

const formatDnsText = ({ name, isETH }: { name: string; isETH: boolean | undefined }) => {
  if (!name) return ''
  if (!name.includes('.')) return ''
  if (name.endsWith('.box')) return ''
  if (isETH) return ''
  return name
}
const addDnsDropdownItem =
  ({ name, isETH }: { name: string; isETH: boolean | undefined }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    const formattedDnsName = formatDnsText({ name, isETH })
    if (!formattedDnsName) return dropdownItems
    return [
      ...dropdownItems,
      {
        text: formattedDnsName,
        nameType: 'dns',
      } as const,
    ]
  }

const addErrorDropdownItem =
  ({ name, isValid }: { name: string; isValid: boolean | undefined }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    if (isValid || name === '') return dropdownItems
    return [
      {
        text: 'Invalid name',
        nameType: 'error',
      } as const,
    ]
  }

const addInfoDropdownItem =
  ({ t }: { t: TFunction }) =>
  (dropdownItems: AnyItem[]): AnyItem[] => {
    if (dropdownItems.length) return dropdownItems
    return [
      {
        text: t('search.emptyText'),
        nameType: 'text',
      } as const,
    ]
  }

const useBuildDropdownItems = (inputVal: string, history: HistoryItem[]) => {
  const { t } = useTranslation('common')

  const inputIsAddress = useMemo(() => isAddress(inputVal), [inputVal])

  const { isValid, isETH, name } = useValidate({
    input: inputVal,
    enabled: !inputIsAddress && !inputVal,
  })

  return useMemo(
    () =>
      thread(
        [],
        addEthDropdownItem({ name, isETH }),
        addBoxDropdownItem({ name, isValid }),
        addDnsDropdownItem({ name, isETH }),
        addAddressItem({ name, inputIsAddress }),
        addTldDropdownItem({ name }),
        addHistoryDropdownItems({ name, history }),
        addErrorDropdownItem({ name, isValid }),
        addInfoDropdownItem({ t }),
      ),
    [inputIsAddress, name, isETH, isValid, history, t],
  )
}

const debouncer = debounce((setFunc: () => void) => setFunc(), 250)

export const SearchInput = ({ size = 'extraLarge' }: { size?: 'medium' | 'extraLarge' }) => {
  const router = useRouterWithHistory()
  const breakpoints = useBreakpoint()

  const [inputVal, setInputVal] = useState('')

  const [state, toggle] = useTransition({
    enter: true,
    exit: true,
    preEnter: true,
    preExit: true,
    mountOnEnter: true,
    unmountOnExit: true,
    timeout: {
      enter: 0,
      exit: 350,
    },
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchInputContainerRef = useRef<HTMLDivElement>(null)
  const { width } = useElementSize(searchInputContainerRef.current)

  const [selected, setSelected] = useState(0)
  const [usingPlaceholder, setUsingPlaceholder] = useState(false)

  const [history, setHistory] = useLocalStorage<HistoryItem[]>('search-history-v2', [])

  const handleFocusIn = useCallback(() => toggle(true), [toggle])
  const handleFocusOut = useCallback(() => toggle(false), [toggle])

  const dropdownItems = useBuildDropdownItems(inputVal, history)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSearch = useCallback(createSearchHandler({ router, setHistory, dropdownItems }), [
    router,
    setHistory,
    dropdownItems,
  ])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleKeyDownCb = useCallback(
    handleKeyDown({ dropdownItems, handleSearch, selected, setSelected }),
    [handleSearch, setSelected, dropdownItems.length, selected],
  )

  useAddEventListeners({
    searchInputRef,
    handleKeyDown: handleKeyDownCb,
    handleFocusIn,
    handleFocusOut,
  })

  useSelectionManager({ inputVal, setSelected, state })

  const setInput = (val: string) => {
    setInputVal(val)
    setUsingPlaceholder(true)
    debouncer(() => setUsingPlaceholder(false))
  }

  const SearchInputElement = (
    <SearchInputBox
      containerRef={searchInputContainerRef}
      ref={searchInputRef}
      input={inputVal}
      setInput={setInput}
      size={size}
    />
  )

  const SearchResultsElement = (
    <SearchResultsContainer
      style={{
        width: width === Infinity ? undefined : width,
      }}
      onMouseLeave={() => inputVal === '' && setSelected(-1)}
      $state={state}
      data-testid="search-input-results"
      // data-error={!isValid && !inputIsAddress && inputVal !== ''}
    >
      {dropdownItems.map((searchItem, index) => (
        <SearchResult
          clickCallback={handleSearch}
          hoverCallback={setSelected}
          index={index}
          selected={index === selected}
          searchItem={searchItem}
          key={
            searchItem.isHistory
              ? `${searchItem.nameType}-${searchItem.text}`
              : `${searchItem.nameType}`
          }
          usingPlaceholder={searchItem.isHistory ? false : usingPlaceholder}
        />
      ))}
    </SearchResultsContainer>
  )

  if (breakpoints.sm) {
    return (
      <Container data-testid="search-input-desktop" $size={size}>
        {SearchInputElement}
        {state !== 'unmounted' && SearchResultsElement}
      </Container>
    )
  }

  return (
    <Container data-testid="search-input-mobile" $size="extraLarge">
      <MobileSearchInput
        {...{
          SearchInputElement,
          SearchResultsElement,
          searchInputRef,
          state,
          toggle,
        }}
      />
    </Container>
  )
}
