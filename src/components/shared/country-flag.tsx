import * as Flags from 'country-flag-icons/react/3x2'

export function CountryFlag({ iso2, className }: { iso2: string; className?: string }) {
  const Flag = (Flags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[iso2.toUpperCase()]
  if (!Flag) return null
  return <Flag className={className ?? 'h-3.5 w-5 rounded-sm object-cover'} />
}
