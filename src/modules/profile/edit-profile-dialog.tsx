'use client'

import { useState, useRef, type KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataProvider } from '@/lib/data'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { getInitials, formatBytes } from '@/lib/utils'
import { Camera, Plus, X, Upload, FileText, Trash2, Phone, GraduationCap, Award } from 'lucide-react'
import type { User, EducationEntry, CertificationDoc } from '@/types'

const IMG_MAX = 2 * 1024 * 1024   // 2 MB avatar cap (kept small so it persists in localStorage)
const DOC_MAX = 3 * 1024 * 1024   // 3 MB certification file cap
const DOC_ACCEPT = '.pdf,.doc,.docx'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

// ── Reusable tag input (languages / skills / expertise) ──────────────────────
function TagInput({ label, values, onChange, placeholder }: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) { setDraft(''); return }
    onChange([...values, v])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder} />
        <Button type="button" variant="outline" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="rounded-full hover:bg-destructive/15 hover:text-destructive p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function EditProfileDialog({ user, open, onOpenChange }: {
  user: User
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const dp = getDataProvider()
  const qc = useQueryClient()
  const avatarRef = useRef<HTMLInputElement>(null)

  // Local editable copy — seeded from the user each time the dialog opens.
  const [name, setName] = useState(user.name)
  const [avatar, setAvatar] = useState(user.avatar ?? '')
  const [about, setAbout] = useState(user.about ?? '')
  const [contacts, setContacts] = useState<string[]>(user.contact_numbers ?? [])
  const [languages, setLanguages] = useState<string[]>(user.languages ?? [])
  const [skills, setSkills] = useState<string[]>(user.technical_skills ?? [])
  const [expertise, setExpertise] = useState<string[]>(user.expertise ?? [])
  const [education, setEducation] = useState<EducationEntry[]>(user.education ?? [])
  const [certs, setCerts] = useState<CertificationDoc[]>(user.certifications ?? [])

  const save = useMutation({
    mutationFn: () => dp.updateUser(user.id, {
      name: name.trim() || user.name,
      avatar,
      about: about.trim(),
      contact_numbers: contacts.filter((c) => c.trim()),
      languages,
      technical_skills: skills,
      expertise,
      education: education.filter((e) => e.degree.trim() || e.institution.trim()),
      certifications: certs.filter((c) => c.title.trim()),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Profile updated', variant: 'success' })
      onOpenChange(false)
    },
    onError: () => toast({ title: 'Could not save profile', description: 'The upload may be too large to store.', variant: 'destructive' }),
  })

  async function onAvatarPick(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast({ title: 'Please choose an image file', variant: 'destructive' }); return }
    if (file.size > IMG_MAX) { toast({ title: `Image exceeds ${formatBytes(IMG_MAX)}`, variant: 'destructive' }); return }
    setAvatar(await fileToDataUrl(file))
  }

  async function onCertFilePick(certId: string, file?: File) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'doc', 'docx'].includes(ext)) { toast({ title: 'Only PDF or DOC files are allowed', variant: 'destructive' }); return }
    if (file.size > DOC_MAX) { toast({ title: `File exceeds ${formatBytes(DOC_MAX)}`, variant: 'destructive' }); return }
    const dataUrl = await fileToDataUrl(file)
    setCerts((prev) => prev.map((c) => c.id === certId
      ? { ...c, file_url: dataUrl, file_name: file.name, file_type: file.type || 'application/octet-stream', size: file.size }
      : c))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>

        <div className="space-y-6">
          {/* Picture + Name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar name={name} avatarUrl={avatar} userId={user.id} size="xl" border shadow />
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-background hover:opacity-90 transition-opacity"
                title="Change picture"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onAvatarPick(e.target.files?.[0] ?? undefined)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              {avatar && (
                <button type="button" onClick={() => setAvatar('')} className="text-xs text-muted-foreground hover:text-destructive">Remove picture</button>
              )}
            </div>
          </div>

          {/* About */}
          <div className="space-y-1.5">
            <Label>About</Label>
            <Textarea rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="A short description about yourself…" />
          </div>

          {/* Skills / Expertise / Languages */}
          <TagInput label="Technical Skills" values={skills} onChange={setSkills} placeholder="Add a skill and press Enter" />
          <TagInput label="Expertise" values={expertise} onChange={setExpertise} placeholder="Add an area of expertise" />
          <TagInput label="Languages" values={languages} onChange={setLanguages} placeholder="Add a language" />

          {/* Contact numbers */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact Numbers</Label>
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={c} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? e.target.value : x))} placeholder="+880 …" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setContacts([...contacts, ''])}>
                <Plus className="h-3.5 w-3.5" /> Add Number
              </Button>
            </div>
          </div>

          {/* Education */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Education</Label>
            {education.map((e) => (
              <div key={e.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Input value={e.degree} onChange={(ev) => setEducation(education.map((x) => x.id === e.id ? { ...x, degree: ev.target.value } : x))} placeholder="Degree / qualification (e.g. BSc in CSE)" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEducation(education.filter((x) => x.id !== e.id))}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <Input value={e.institution} onChange={(ev) => setEducation(education.map((x) => x.id === e.id ? { ...x, institution: ev.target.value } : x))} placeholder="Institution" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={e.year ?? ''} onChange={(ev) => setEducation(education.map((x) => x.id === e.id ? { ...x, year: ev.target.value } : x))} placeholder="Year" />
                  <Input value={e.gpa ?? ''} onChange={(ev) => setEducation(education.map((x) => x.id === e.id ? { ...x, gpa: ev.target.value } : x))} placeholder="CGPA / GPA (e.g. 3.85)" />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setEducation([...education, { id: newId(), degree: '', institution: '', year: '' }])}>
              <Plus className="h-3.5 w-3.5" /> Add Education
            </Button>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Certifications</Label>
            {certs.map((c) => (
              <div key={c.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Input value={c.title} onChange={(ev) => setCerts(certs.map((x) => x.id === c.id ? { ...x, title: ev.target.value } : x))} placeholder="Certification title" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setCerts(certs.filter((x) => x.id !== c.id))}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
                <Textarea rows={2} value={c.description ?? ''} onChange={(ev) => setCerts(certs.map((x) => x.id === c.id ? { ...x, description: ev.target.value } : x))} placeholder="Short description (optional)" />
                {c.file_name ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">{c.file_name}{c.size ? ` · ${formatBytes(c.size)}` : ''}</span>
                    <CertFileButton certId={c.id} label="Replace" onPick={onCertFilePick} />
                    <button type="button" onClick={() => setCerts(certs.map((x) => x.id === c.id ? { ...x, file_url: undefined, file_name: undefined, file_type: undefined, size: undefined } : x))} className="text-muted-foreground hover:text-destructive p-1" title="Remove file">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <CertFileButton certId={c.id} label="Upload PDF / DOC" onPick={onCertFilePick} block />
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setCerts([...certs, { id: newId(), title: '', description: '' }])}>
              <Plus className="h-3.5 w-3.5" /> Add Certification
            </Button>
            <p className="text-[10px] text-muted-foreground">Accepted: {DOC_ACCEPT} · up to {formatBytes(DOC_MAX)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Small file-picker button used for certification upload/replace.
function CertFileButton({ certId, label, onPick, block }: {
  certId: string
  label: string
  onPick: (certId: string, file?: File) => void
  block?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={block ? 'w-full' : 'h-7'} onClick={() => ref.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {label}
      </Button>
      <input ref={ref} type="file" accept={DOC_ACCEPT} className="sr-only" onChange={(e) => { onPick(certId, e.target.files?.[0] ?? undefined); if (ref.current) ref.current.value = '' }} />
    </>
  )
}