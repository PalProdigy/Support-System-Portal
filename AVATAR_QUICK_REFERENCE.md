# Avatar Component - Quick Reference

## When Profile Pictures Should Display

### User Objects with Avatar Field
The avatar component automatically displays profile pictures from the `User` type which includes:

```typescript
// User model (from src/types/index.ts)
export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string           // ← Profile picture URL
  is_active: boolean
  // ... other fields
}
```

### Available in All Roles
- ✅ Technical Head (`technical_head`)
- ✅ Team Lead (`team_lead`)
- ✅ Support Engineer (`support_engineer`)
- ✅ Sales Executive (`sales_executive`)
- ✅ Client (`client`)

## Quick Copy-Paste Examples

### In Navigation (Topbar/Sidebar)
```tsx
import { UserAvatar } from '@/components/shared/user-avatar'

// In topbar or sidebar menu
<UserAvatar 
  name={session?.userName} 
  userId={session?.userId}
  size="sm" 
  border={false}
  shadow={false}
/>
```

### In User Lists/Tables
```tsx
<table>
  {users.map(user => (
    <tr>
      <td>
        <UserAvatar 
          name={user.name}
          avatarUrl={user.avatar}
          userId={user.id}
          size="sm"
          border={false}
        />
      </td>
    </tr>
  ))}
</table>
```

### In Profile Sections
```tsx
<div className="profile-header">
  <UserAvatar 
    name={user.name}
    avatarUrl={user.avatar}
    userId={user.id}
    size="lg"
    border
    shadow
  />
  <h1>{user.name}</h1>
</div>
```

### In Comment Threads
```tsx
<div className="comment">
  <UserAvatar 
    name={comment.author_name}
    avatarUrl={author?.avatar}
    userId={comment.author_id}
    size="sm"
    border={false}
  />
  <p>{comment.body}</p>
</div>
```

### In Dialog/Modal
```tsx
<UserAvatar 
  name={user.name}
  avatarUrl={user.avatar}
  userId={user.id}
  size="xl"
  border
  shadow
/>
```

## Where Avatars Are Already Integrated

### ✅ Fully Updated Modules

**Layout**
- [x] Topbar (top-right user menu)
- [x] Sidebar (left navigation user info)

**Profiles**
- [x] Profile headers (all roles)
- [x] Edit profile dialog

**Cases**
- [x] Case detail comments
- [x] Sub-case engineer assignment

**Sales Module**
- [x] Pre-sales notes author
- [x] Sales executive directory

## Size Guide

| Size | Pixels | Context | Text Size |
|------|--------|---------|-----------|
| sm | 6×6 | Tables, lists, inline | 10px |
| md | 8×8 | Default, compact | 12px |
| lg | 10×10 | Profile headers | 14px |
| xl | 12×12 | Dialogs, large | 16px |

## Color Fallback (No Picture)

When no profile picture exists, avatars show initials with professional colors:

- Colors are **deterministic** based on user ID
- Same user = same color across all sessions
- 12 color palette ensures variety
- Works with light and dark modes

Example initials by role:
- John Doe (TH) → "JD" on blue background
- Sarah Smith (TL) → "SS" on purple background
- Mike Johnson (SE) → "MJ" on green background

## Image URL Support

The component accepts any image URL format:

```typescript
// HTTP/HTTPS URLs
user.avatar = "https://example.com/avatars/user123.jpg"

// Data URLs (base64 - from file upload)
user.avatar = "data:image/png;base64,iVBORw0KGgoAAAANS..."

// Blob URLs (from file input)
user.avatar = "blob:http://localhost:3000/a1b2c3d4"
```

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| No profile picture | Shows initials |
| Broken image URL | Falls back to initials |
| Missing name | Shows "?" |
| Network error | Falls back to initials |
| Null/undefined avatar | Shows initials |
| Empty string name | Shows "?" |
| Very long name | Truncated to 2 initials |

## Dark Mode

The avatar component automatically adapts to dark mode:

```typescript
// The component uses these Tailwind classes
className="border border-slate-200 dark:border-slate-700"
```

No special configuration needed - all styling is responsive.

## Props Reference

```typescript
// Minimal (works with defaults)
<UserAvatar name="John Doe" />

// Complete (all features)
<UserAvatar
  name={user.name}              // Required: full name
  avatarUrl={user.avatar}       // Optional: profile picture URL
  userId={user.id}              // Optional: for color consistency
  size="md"                      // Optional: sm | md | lg | xl
  border={true}                 // Optional: show border
  shadow={true}                 // Optional: show shadow
  className="custom-class"      // Optional: additional CSS
/>
```

## Testing

To test avatar functionality:

1. **With profile picture**
   - Upload an image in profile settings
   - Avatar shows the image

2. **Without profile picture**
   - Edit profile and remove/don't upload image
   - Avatar shows initials with color

3. **Broken image**
   - Set invalid avatar URL in browser DevTools
   - Avatar falls back to initials

4. **Different sizes**
   - Try each size preset (sm, md, lg, xl)
   - Verify text scales appropriately

5. **Dark mode**
   - Toggle dark theme in settings
   - Avatar borders and colors adapt

## Troubleshooting Checklist

- [ ] User object has `avatar` field populated?
- [ ] Image URL is valid (not null, not empty string)?
- [ ] Using correct size for context (sm in tables, lg in headers)?
- [ ] Dark mode styling visible? (borders may be subtle)
- [ ] Initials showing for roles without pictures? (Expected)
- [ ] Colors consistent for same user? (Expected with userId)

## TypeScript Support

Full type safety included:

```typescript
// UserAvatar props are fully typed
function MyComponent({ user }: { user: User }) {
  return (
    <UserAvatar 
      name={user.name}           // ✅ string (required)
      avatarUrl={user.avatar}    // ✅ string | undefined (optional)
      userId={user.id}           // ✅ string (optional but recommended)
      size="lg"                  // ✅ 'sm' | 'md' | 'lg' | 'xl'
      border={true}              // ✅ boolean (optional)
      shadow={true}              // ✅ boolean (optional)
    />
  )
}
```

## Common Patterns

### Pattern 1: User Directory Row
```tsx
{users.map(user => (
  <tr key={user.id} className="hover:bg-muted/30">
    <td className="px-4 py-3">
      <div className="flex items-center gap-2">
        <UserAvatar 
          name={user.name}
          avatarUrl={user.avatar}
          userId={user.id}
          size="sm"
          border={false}
        />
        <span>{user.name}</span>
      </div>
    </td>
  </tr>
))}
```

### Pattern 2: Comment Thread
```tsx
{comments.map(comment => (
  <div key={comment.id} className="p-4 border rounded">
    <div className="flex gap-2">
      <UserAvatar 
        name={author.name}
        avatarUrl={author.avatar}
        userId={comment.author_id}
        size="sm"
        border={false}
        shadow={false}
      />
      <div>
        <strong>{author.name}</strong>
        <p>{comment.body}</p>
      </div>
    </div>
  </div>
))}
```

### Pattern 3: Profile Card
```tsx
<div className="card p-6">
  <UserAvatar 
    name={user.name}
    avatarUrl={user.avatar}
    userId={user.id}
    size="xl"
    border
    shadow
  />
  <h2>{user.name}</h2>
  <p className="text-muted-foreground">{user.email}</p>
</div>
```

---

**Need more examples?** Check `AVATAR_IMPLEMENTATION.md` for comprehensive documentation.
