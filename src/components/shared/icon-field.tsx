import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Icon-prefixed labeled input — shared look for every "create profile" dialog.
export function IconField({ icon: Icon, label, required, hint, ...inputProps }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  required?: boolean
  hint?: string
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9 h-10 rounded-lg" {...inputProps} />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
