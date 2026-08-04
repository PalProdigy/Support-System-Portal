'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NewCaseDialog } from '@/modules/cases/new-case-dialog'

// Deep-link fallback (e.g. from a Service detail page's "Raise a Case" link,
// or a bookmarked /cases/new URL) — opens the same modal used everywhere else
// instead of a dedicated page, then returns to wherever the user came from.
function NewCaseRoute() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(true)

  return (
    <NewCaseDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) router.back()
      }}
      prefill={{
        title: searchParams.get('title') ?? undefined,
        description: searchParams.get('description') ?? undefined,
        solutionName: searchParams.get('solution') ?? undefined,
      }}
    />
  )
}

export default function NewCasePage() {
  return (
    <Suspense fallback={null}>
      <NewCaseRoute />
    </Suspense>
  )
}
