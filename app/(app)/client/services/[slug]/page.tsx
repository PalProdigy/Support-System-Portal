'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, CheckCircle2, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NewCaseDialog } from '@/modules/cases/new-case-dialog'
import { getService } from '@/data/services'

export default function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const service = getService(slug)
  const [newCaseOpen, setNewCaseOpen] = useState(false)

  if (!service) notFound()
  const Icon = service.icon

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/client/services"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Services
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-primary/10 p-3 shrink-0">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">{service.title}</h1>
          <p className="text-sm text-muted-foreground">{service.description}</p>
        </div>
      </div>

      {/* Overview */}
      <div className="rounded-xl border bg-card p-5 space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overview</h2>
        <p className="text-sm text-foreground leading-relaxed">{service.overview}</p>
      </div>

      {/* Highlights */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">What&apos;s Included</h2>
        <ul className="space-y-2">
          {service.highlights.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setNewCaseOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Create Case
        </Button>
        <Button asChild variant="outline">
          <Link href="/client/services">Back to Services</Link>
        </Button>
      </div>

      <NewCaseDialog
        open={newCaseOpen}
        onOpenChange={setNewCaseOpen}
        prefill={{
          title: `Service Request: ${service.title}`,
          description: `Request for the "${service.title}" service.\n\n${service.overview}`,
          solutionName: service.title,
        }}
      />
    </div>
  )
}
