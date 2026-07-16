'use client'

import { useState, useCallback } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'
import {
  getAvatarColorScheme,
  isValidImageUrl,
  getAvatarBorderClasses,
  getAvatarShadowClasses,
  getAvatarSizeClasses,
} from '@/lib/avatar'

interface UserAvatarProps {
  /** User's full name (used for initials fallback) */
  name: string
  /** Profile picture URL (can be data URL, blob, or http/https URL) */
  avatarUrl?: string
  /** User ID or identifier for deterministic color assignment */
  userId?: string
  /** Avatar size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Additional CSS classes to apply to the avatar */
  className?: string
  /** Show subtle border around the avatar */
  border?: boolean
  /** Show shadow effect */
  shadow?: boolean
}

/**
 * Enhanced UserAvatar component with profile picture support.
 *
 * Features:
 * - Displays profile picture if available and valid
 * - Gracefully falls back to name initials if image fails to load
 * - Deterministic color scheme based on user identifier
 * - Professional, modern styling with borders and shadows
 * - Responsive sizing (sm, md, lg, xl)
 * - Handles all image URL types (data URLs, blob, http/https)
 * - Accessibility attributes for screen readers
 *
 * Usage:
 * ```tsx
 * <UserAvatar
 *   name="John Doe"
 *   avatarUrl={user.avatar}
 *   userId={user.id}
 *   size="md"
 *   border
 *   shadow
 * />
 * ```
 */
export function UserAvatar({
  name,
  avatarUrl,
  userId,
  size = 'md',
  className,
  border = true,
  shadow = true,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const initials = getInitials(name)
  const identifier = userId || name
  const colorScheme = getAvatarColorScheme(identifier)

  // Check if we have a valid image URL and no previous errors
  const hasValidImage = !imageError && isValidImageUrl(avatarUrl)

  // Handle image load success
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  // Handle image load failure - fall back to initials
  const handleImageError = useCallback(() => {
    setImageError(true)
    setImageLoaded(false)
  }, [])

  const sizeClasses = getAvatarSizeClasses(size)
  const borderClasses = border ? getAvatarBorderClasses(size) : ''
  const shadowClasses = shadow ? getAvatarShadowClasses(size) : ''

  return (
    <Avatar
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full transition-all duration-200',
        sizeClasses,
        borderClasses,
        shadowClasses,
        className,
      )}
      title={name}
    >
      {/* Profile Picture Image */}
      {hasValidImage && (
        <AvatarImage
          src={avatarUrl}
          alt={name}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={cn(
            'aspect-square h-full w-full object-cover transition-opacity duration-200',
            imageLoaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {/* Initials Fallback */}
      <AvatarFallback
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold',
          colorScheme.bg,
          colorScheme.text,
          'transition-colors duration-200',
        )}
        asChild={false}
      >
        <span aria-label={`${name} avatar`}>{initials}</span>
      </AvatarFallback>
    </Avatar>
  )
}