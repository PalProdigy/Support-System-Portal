import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatarUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(SIZE_MAP[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}