'use client'

import { useRouter } from 'next/navigation'
import { NewSolutionForm } from '@/modules/solutions/new-solution-form'

export default function NewSolutionPage() {
  const router = useRouter()
  return <NewSolutionForm onBack={() => router.push('/solutions')} />
}
