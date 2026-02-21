import { useState, useRef } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useTrackers } from '../hooks/useTrackers'
import { useFamilyMembers, updateMember, updateFamily } from '../hooks/useFamily'
import { ROLES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { cn } from '../lib/utils'

export function ProfilePage() {
  const { identity, user, signOut, saveIdentity } = useApp()
  const members = useFamilyMembers(identity.familyId)
  const [role, setRole] = useState(identity.memberName ?? '')
  const [customRole, setCustomRole] = useState('')
  const [familyNameEdit, setFamilyNameEdit] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(identity.memberAvatarUrl ?? identity.googleAvatarUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)

  // Load family name from first member's family — we'll fetch it separately
  const [family, setFamily] = useState(null)
  useState(() => {
    if (!identity.familyId) return
    supabase.from('families').select().eq('id', identity.familyId).single()
      .then(({ data }) => { if (data) { setFamily(data); setFamilyNameEdit(data.name) } })
  })

  async function handleSave() {
    setSaving(true)
    try {
      const displayName = role === 'אחר' ? (customRole || 'אחר') : role
      await updateMember(identity.memberId, { display_name: displayName, role: displayName, avatar_url: avatarUrl })
      if (familyNameEdit && familyNameEdit !== family?.name) {
        await updateFamily(identity.familyId, { name: familyNameEdit })
      }
      saveIdentity({ familyId: identity.familyId, memberId: identity.memberId, memberName: displayName })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Upload to Supabase Storage
    const ext = file.name.split('.').pop()
    const path = `members/${identity.memberId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
    }
  }

  function handleCopyCode() {
    if (family?.code) {
      navigator.clipboard.writeText(family.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const selectedRole = ROLES.find(r => r.value === role) ?? ROLES.find(r => r.value === 'אחר')

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="font-rubik font-bold text-2xl text-brown-800 mb-5">{t('profile.title')}</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-cream-200 shadow-card">
            {avatarUrl
              ? <img src={avatarUrl} alt="אווטר" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-4xl">{selectedRole?.emoji ?? '👤'}</div>
            }
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 left-0 w-8 h-8 bg-brown-600 rounded-full flex items-center justify-center text-white shadow-soft"
          >
            📷
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <p className="font-rubik font-semibold text-brown-800 text-lg mt-2">{user?.user_metadata?.full_name}</p>
        <p className="font-rubik text-brown-400 text-sm">{user?.email}</p>
      </div>

      {/* Role selection */}
      <Card className="mb-3">
        <p className="text-sm font-medium text-brown-500 font-rubik mb-3">{t('profile.myRole')}</p>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 rounded-2xl font-rubik text-sm font-medium transition-all active:scale-95',
                role === r.value ? 'bg-brown-600 text-white' : 'bg-cream-100 text-brown-700'
              )}
            >
              <span className="text-xl">{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>
        {role === 'אחר' && (
          <input
            type="text"
            value={customRole}
            onChange={e => setCustomRole(e.target.value)}
            placeholder={t('setup.customRolePlaceholder')}
            className="mt-3 w-full bg-cream-100 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none"
          />
        )}
      </Card>

      {/* Family name */}
      <Card className="mb-3">
        <p className="text-sm font-medium text-brown-500 font-rubik mb-2">{t('profile.familyName')}</p>
        <input
          type="text"
          value={familyNameEdit}
          onChange={e => setFamilyNameEdit(e.target.value)}
          className="w-full bg-cream-100 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none"
        />
      </Card>

      {/* Family code */}
      <Card className="mb-4">
        <p className="text-sm font-medium text-brown-500 font-rubik mb-1">{t('profile.familyCode')}</p>
        <div className="flex items-center justify-between">
          <p className="font-rubik font-bold text-3xl tracking-widest text-brown-800">{family?.code ?? '...'}</p>
          <button
            onClick={handleCopyCode}
            className="text-sm font-rubik text-brown-600 bg-cream-200 px-4 py-2 rounded-full active:scale-95 transition-transform"
          >
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>
        <p className="text-xs text-brown-400 font-rubik mt-1">{t('profile.familyCodeHint')}</p>
      </Card>

      {/* Family members */}
      <Card className="mb-5">
        <p className="text-sm font-medium text-brown-500 font-rubik mb-3">{t('profile.members')}</p>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center text-lg flex-shrink-0">
                {m.avatar_url
                  ? <img src={m.avatar_url} alt={m.display_name} className="w-full h-full object-cover" />
                  : <span>{ROLES.find(r => r.value === m.role)?.emoji ?? '👤'}</span>
                }
              </div>
              <div>
                <p className="font-rubik font-medium text-brown-800 text-sm">{m.display_name}</p>
                {m.id === identity.memberId && <p className="text-xs text-brown-400 font-rubik">אתה</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Save button */}
      <Button className="w-full mb-3" size="lg" onClick={handleSave} disabled={saving}>
        {saved ? t('profile.changesSaved') : saving ? t('app.loading') : t('profile.saveChanges')}
      </Button>

      {/* Sign out */}
      <Button variant="ghost" className="w-full text-brown-400" onClick={() => setSignOutConfirm(true)}>
        {t('profile.signOut')}
      </Button>

      <ConfirmDialog
        isOpen={signOutConfirm}
        message={t('profile.signOutConfirm')}
        onConfirm={signOut}
        onCancel={() => setSignOutConfirm(false)}
      />
    </div>
  )
}
