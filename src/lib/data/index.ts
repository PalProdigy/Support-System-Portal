'use client'

import type { DataProvider } from './provider'
import { mockDataProvider } from './mock'
import { apiDataProvider } from './api'

export function getDataProvider(): DataProvider {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === 'api') return apiDataProvider
  return mockDataProvider
}

export type { DataProvider } from './provider'
export type { ListScope, CaseFilters, Paginated } from './provider'