'use client'

import Link from 'next/link'
import { LayoutGrid, ArrowRight } from 'lucide-react'
import { SERVICES } from '@/data/services'

export default function ClientServicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <LayoutGrid className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Services</h1>
          <p className="text-sm text-muted-foreground">Explore the services NHQ Distributions Ltd. provides</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map((service) => {
          const Icon = service.icon
          return (
            <Link
              key={service.slug}
              href={`/client/services/${service.slug}`}
              className="group rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="rounded-lg bg-primary/10 p-2 w-fit">
                <Icon className="h-5 w-5 text-primary" />
              </div>

              <div className="space-y-1 flex-1">
                <h3 className="font-semibold text-foreground">{service.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{service.description}</p>
              </div>

              <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                Learn More
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
