/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLatest } from '@vainjs/hooks'
import { useCallback } from 'react'

export function useMemoizedFn<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useLatest(fn)

  return useCallback((...args: any[]) => fnRef.current(...args), [fnRef]) as T
}
