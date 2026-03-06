import { useState, useRef } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useFamilyMembers, updateMember, updateFamily, removeMember } from '../hooks/useFamily'
import { useChildren, addChild } from '../hooks/useChildren'
import { generateFamilyCode } from '../lib/utils'
import { ROLES, ADMIN_EMAIL, PARENT_ROLES, STORAGE_KEYS } from '../lib/constants'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'
import { PushNotificationSettings } from '../components/PushNotificationSettings'

export function ProfilePage() {
  const { identity, user, signOut, saveIdentity, setMemberAvatarUrl } = useApp()
  const navigate = useNavigate()
  const isAdmin = user?.email === ADMIN_EMAIL
  const members = useFamilyMembers(identity.familyId)
  const { children, updateChild, deleteChild } = useChildren(identity.familyId)
  const { toasts, showToast, dismissToast } = useToast()

  // ── My profile state ──────────────────────────────────────────────────────
  const [role, setRole] = useState(identity.memberName ?? '')
  const [customRole, setCustomRole] = useState('')
  const [familyNameEdit, setFamilyNameEdit] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(identity.memberAvatarUrl ?? identity.googleAvatarUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const fileInputRef = useRef(null)

  // ── Family state ──────────────────────────────────────────────────────────
  const [family, setFamily] = useState(null)
  const [copied, setCopied] = useState(false)
  const [refreshingCode, setRefreshingCode] = useState(false)
  const [failedAvatars, setFailedAvatars] = useState(new Set())

  // ── Children state ────────────────────────────────────────────────────────
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [editChildTarget, setEditChildTarget] = useState(null)
  const [deleteChildTarget, setDeleteChildTarget] = useState(null)

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notificationsOn, setNotificationsOn] = useState(
    () => localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) === null
      ? true
      : localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) === 'true'
  )

  function toggleNotifications() {
    const next = !notificationsOn
    setNotificationsOn(next)
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(next))
    showToast({ message: next ? t('profile.notificationsOn') : t('profile.notificationsOff'), emoji: next ? '🔔' : '🔕' })
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)

  const isParent = PARENT_ROLES.includes(identity.memberName)
  const selectedRole = ROLES.find(r => r.value === role) ?? ROLES.find(r => r.value === 'אחר')

  // Load family
  useState(() => {
    if (!identity.familyId) return
    supabase.from('families').select().eq('id', identity.familyId).single()
      .then(({ data }) => { if (data) { setFamily(data); setFamilyNameEdit(data.name) } })
  })

  const isDirty = role !== (identity.memberName ?? '') || familyNameEdit !== (family?.name ?? '')

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const displayName = role === 'אחר' ? (customRole || 'אחר') : role
      await updateMember(identity.memberId, { display_name: displayName, role: displayName, avatar_url: avatarUrl })
      if (familyNameEdit && familyNameEdit !== family?.name) {
        await updateFamily(identity.familyId, { name: familyNameEdit })
      }
      saveIdentity({ familyId: identity.familyId, memberId: identity.memberId, memberName: displayName })
      setMemberAvatarUrl(avatarUrl)
      showToast({ message: t('profile.profileSaved'), emoji: '✅' })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('uploading')
    try {
      const ext = file.name.split('.').pop()
      const path = `members/${identity.memberId}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl
      setAvatarUrl(url)
      setMemberAvatarUrl(url)
      await updateMember(identity.memberId, { avatar_url: url })
      setUploadStatus('success')
      setTimeout(() => setUploadStatus(null), 2500)
    } catch {
      setUploadStatus('error')
      setTimeout(() => setUploadStatus(null), 3000)
    }
  }

  function handleCopyCode() {
    if (family?.code) {
      navigator.clipboard.writeText(family.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleRefreshCode() {
    if (!isParent || refreshingCode) return
    setRefreshingCode(true)
    try {
      const newCode = generateFamilyCode()
      await updateFamily(identity.familyId, { code: newCode })
      setFamily(prev => ({ ...prev, code: newCode }))
    } finally {
      setRefreshingCode(false)
    }
  }

  async function handleChildSave({ name, avatarFile, birthDate, gender }, isEdit) {
    let uploadedUrl = isEdit ? editChildTarget.avatar_url : null
    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `children/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, avatarFile)
      if (!error) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        uploadedUrl = data.publicUrl
      }
    }
    if (isEdit) {
      await updateChild(editChildTarget.id, { name, avatar_url: uploadedUrl, birth_date: birthDate || null, gender: gender || null })
      setEditChildTarget(null)
      showToast({ message: t('profile.childUpdated'), emoji: '✅' })
    } else {
      await addChild({ familyId: identity.familyId, name, avatarUrl: uploadedUrl, birthDate, gender })
      setAddChildOpen(false)
      showToast({ message: t('profile.childAdded', { name }), emoji: '👶' })
    }
  }

  async function handleDeleteChild() {
    if (!deleteChildTarget) return
    try {
      await deleteChild(deleteChildTarget.id)
      showToast({ message: t('profile.childRemoved', { name: deleteChildTarget.name }), emoji: '🗑' })
    } catch { /* ignore */ }
    setDeleteChildTarget(null)
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Profile card */}
      <Card>
        {/* Avatar row + details */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-cream-200 shadow-soft">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl">{selectedRole?.emoji ?? '👤'}</div>
              }
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadStatus === 'uploading'}
              className="absolute bottom-0 left-0 w-6 h-6 bg-brown-600 rounded-full flex items-center justify-center text-white text-xs shadow-soft disabled:opacity-60 active:scale-95 transition-transform"
            >
              {uploadStatus === 'uploading' ? '⏳' : '📷'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-rubik font-bold text-brown-800 text-base leading-tight truncate">{user?.user_metadata?.full_name}</p>
            <p className="font-rubik text-brown-400 text-xs truncate">{user?.email}</p>
            {uploadStatus === 'success' && <p className="text-xs text-green-600 font-rubik font-medium mt-0.5">{t('profile.photoUploaded')}</p>}
            {uploadStatus === 'error' && <p className="text-xs text-red-500 font-rubik font-medium mt-0.5">{t('profile.photoError')}</p>}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-rubik font-semibold text-brown-600 bg-brown-100 border border-brown-400 px-2.5 py-1 rounded-full active:scale-95 transition-transform"
              >
                🔐 {t('profile.admin')}
              </button>
            )}
          </div>
        </div>

        {/* Role selector — horizontal pills */}
        <p className="text-xs font-medium text-brown-400 font-rubik mb-2">{t('profile.myRole')}</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-rubik text-sm font-medium transition-all active:scale-95',
                role === r.value ? 'bg-amber-500 text-white shadow-soft' : 'bg-cream-100 text-brown-700'
              )}
            >
              <span>{r.emoji}</span>
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
            className="mb-4 w-full bg-cream-100 rounded-2xl px-4 py-2.5 font-rubik text-brown-800 outline-none text-sm"
          />
        )}

        {/* Family name — inline edit */}
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-brown-500 font-rubik whitespace-nowrap flex-shrink-0">{t('profile.familyName')}</p>
          <input
            type="text"
            value={familyNameEdit}
            onChange={e => setFamilyNameEdit(e.target.value)}
            className="flex-1 bg-cream-100 rounded-2xl px-3 py-2 font-rubik text-brown-800 outline-none text-sm"
          />
        </div>

        {/* Save button — only when dirty */}
        {isDirty && (
          <Button className="w-full mt-3" onClick={handleSave} disabled={saving}>
            {saving ? t('app.loading') : t('profile.saveChanges')}
          </Button>
        )}
      </Card>

      {/* Children section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-rubik font-semibold text-brown-400 text-xs uppercase tracking-wider">{t('profile.childrenSection')}</p>
          {isParent && (
            <button
              onClick={() => setAddChildOpen(true)}
              className="text-sm font-rubik font-semibold text-white bg-amber-600 px-3 py-1 rounded-full active:scale-95 transition-transform shadow-soft"
            >
              {t('profile.addChildButton')}
            </button>
          )}
        </div>

        {children.length === 0 ? (
          <button
            onClick={() => isParent && setAddChildOpen(true)}
            className="w-full py-5 rounded-3xl border-2 border-dashed border-cream-300 text-brown-400 font-rubik text-sm text-center"
          >
            <div className="text-2xl mb-1">👶</div>
            {t('children.noChildren')}
          </button>
        ) : (
          <div className={cn('gap-2', children.length === 1 ? 'flex flex-col' : 'grid grid-cols-2')}>
            {children.map(child => (
              children.length === 1 ? (
                /* Single child — full-width horizontal layout */
                <div key={child.id} className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0">
                    {child.avatar_url
                      ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                      : <span className="text-2xl">👶</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-rubik font-semibold text-brown-800 text-sm">{child.name}</p>
                    {child.birth_date && (
                      <p className="text-xs text-brown-400 font-rubik">
                        {new Date(child.birth_date).toLocaleDateString('he-IL')}
                      </p>
                    )}
                  </div>
                  {isParent && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditChildTarget(child)}
                        className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-sm active:scale-95 transition-transform"
                      >✏️</button>
                      <button
                        onClick={() => setDeleteChildTarget(child)}
                        className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-sm active:scale-95 transition-transform"
                      >🗑</button>
                    </div>
                  )}
                </div>
              ) : (
                /* Multiple children — square card */
                <div key={child.id} className="bg-white rounded-2xl shadow-soft p-3 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center mb-2 flex-shrink-0">
                    {child.avatar_url
                      ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                      : <span className="text-2xl">👶</span>
                    }
                  </div>
                  <p className="font-rubik font-semibold text-brown-800 text-sm leading-tight">{child.name}</p>
                  {child.birth_date && (
                    <p className="text-xs text-brown-400 font-rubik mt-0.5">
                      {new Date(child.birth_date).toLocaleDateString('he-IL')}
                    </p>
                  )}
                  {isParent && (
                    <div className="flex gap-2 mt-2 w-full">
                      <button
                        onClick={() => setEditChildTarget(child)}
                        className="flex-1 py-1.5 rounded-xl bg-cream-100 text-sm active:scale-95 transition-transform"
                      >✏️</button>
                      <button
                        onClick={() => setDeleteChildTarget(child)}
                        className="flex-1 py-1.5 rounded-xl bg-red-50 text-sm active:scale-95 transition-transform"
                      >🗑</button>
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Family code + members */}
      <Card>
        {/* Code */}
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs font-medium text-brown-400 font-rubik mb-0.5">{t('profile.familyCode')}</p>
            <p className="font-rubik font-bold text-2xl tracking-widest text-brown-800">{family?.code ?? '...'}</p>
          </div>
          <div className="flex items-center gap-2">
            {isParent && (
              <button
                onClick={handleRefreshCode}
                disabled={refreshingCode}
                className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-500 active:scale-95 transition-transform disabled:opacity-40"
              >
                {refreshingCode ? '⏳' : '🔄'}
              </button>
            )}
            <button
              onClick={handleCopyCode}
              className="text-sm font-rubik text-brown-600 bg-cream-100 px-4 py-2 rounded-full active:scale-95 transition-transform"
            >
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
        </div>
        <p className="text-xs text-brown-400 font-rubik mb-4">{t('profile.familyCodeHint')}</p>

        {/* Family members */}
        <div className="border-t border-cream-200 pt-3">
          <p className="text-xs font-medium text-brown-400 font-rubik mb-3">{t('profile.members')}</p>
          <div className="flex flex-wrap gap-4">
            {members.map(m => (
              <div key={m.id} className="flex flex-col items-center gap-1 relative">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center text-lg">
                  {m.avatar_url && !failedAvatars.has(m.id)
                    ? <img src={m.avatar_url} alt={m.display_name} className="w-full h-full object-cover"
                        onError={() => setFailedAvatars(prev => new Set([...prev, m.id]))} />
                    : <span>{ROLES.find(r => r.value === m.role)?.emoji ?? '👤'}</span>
                  }
                </div>
                <p className="font-rubik text-brown-700 text-xs">{m.display_name}</p>
                {m.id === identity.memberId && (
                  <span className="text-[10px] text-amber-500 font-rubik font-semibold -mt-0.5">{t('profile.you')}</span>
                )}
                {isParent && m.id !== identity.memberId && (
                  <button
                    onClick={() => setRemovingMember(m)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-400 text-xs active:scale-95"
                  >−</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Push Notifications */}
      <PushNotificationSettings familyId={identity.familyId} memberId={identity.memberId} />

      {/* Notifications + sign out */}
      <div className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-rubik font-medium text-brown-800 text-sm">🔔 {t('notifications.title')}</p>
          <p className="font-rubik text-brown-400 text-xs mt-0.5">{t('notifications.subtitle')}</p>
        </div>
        <button
          onClick={toggleNotifications}
          className="relative w-14 h-7 rounded-full transition-colors duration-200 flex-shrink-0"
          style={{ backgroundColor: notificationsOn ? '#22C55E' : '#D6C4B0' }}
        >
          <span
            className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: notificationsOn ? 'translateX(28px)' : 'translateX(2px)' }}
          />
        </button>
      </div>

      <div>
        <Button variant="ghost" className="w-full text-red-400 text-sm" onClick={() => setSignOutConfirm(true)}>
          {t('profile.signOut')}
        </Button>
      </div>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        isOpen={signOutConfirm}
        message={t('profile.signOutConfirm')}
        onConfirm={signOut}
        onCancel={() => setSignOutConfirm(false)}
        confirmLabel={t('auth.signOut')}
        confirmVariant="secondary"
      />
      <ConfirmDialog
        isOpen={!!removingMember}
        message={t('profile.removeMemberConfirm').replace('{{name}}', removingMember?.display_name ?? '')}
        onConfirm={async () => {
          try { await removeMember(removingMember.id) } catch {}
          setRemovingMember(null)
        }}
        onCancel={() => setRemovingMember(null)}
      />
      <ConfirmDialog
        isOpen={!!deleteChildTarget}
        message={t('profile.deleteChildConfirm', { name: deleteChildTarget?.name ?? '' })}
        onConfirm={handleDeleteChild}
        onCancel={() => setDeleteChildTarget(null)}
        confirmVariant="danger"
      />

      {/* Add child */}
      <ChildFormSheet
        isOpen={addChildOpen}
        onClose={() => setAddChildOpen(false)}
        title={t('children.addChild')}
        onSave={data => handleChildSave(data, false)}
      />

      {/* Edit child */}
      {editChildTarget && (
        <ChildFormSheet
          isOpen={Boolean(editChildTarget)}
          onClose={() => setEditChildTarget(null)}
          title={t('children.editChild')}
          initialName={editChildTarget.name}
          initialAvatar={editChildTarget.avatar_url}
          initialBirthDate={editChildTarget.birth_date ?? ''}
          initialGender={editChildTarget.gender ?? ''}
          onSave={data => handleChildSave(data, true)}
        />
      )}
    </div>
  )
}

// ─── Child Form Sheet ────────────────────────────────────────────────────────

function ChildFormSheet({ isOpen, onClose, title, initialName = '', initialAvatar = null, initialBirthDate = '', initialGender = '', onSave }) {
  const [name, setName] = useState(initialName)
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar)
  const [avatarFile, setAvatarFile] = useState(null)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [gender, setGender] = useState(initialGender)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('children.nameRequired')); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), avatarFile, birthDate: birthDate || null, gender: gender || null })
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center active:scale-95 transition-transform border-4 border-white shadow-soft"
          >
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
              : <span className="text-4xl">👶</span>
            }
          </button>
          <button onClick={() => fileRef.current?.click()} className="text-xs font-rubik text-brown-500 bg-cream-200 px-3 py-1.5 rounded-full">
            {t('children.addPhoto')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Name */}
        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('children.childName')}</p>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder={t('children.childNamePlaceholder')}
            className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 text-base outline-none"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1 font-rubik">{error}</p>}
        </div>

        {/* Birth date + Gender — same row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-brown-600 mb-2">{t('children.birthDate')}</p>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setBirthDate(e.target.value)}
              className="w-full bg-cream-200 rounded-2xl px-3 py-3 font-rubik text-brown-800 outline-none text-sm"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-brown-600 mb-2">{t('children.gender')}</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'male', emoji: '👦', label: t('children.male') }, { value: 'female', emoji: '👧', label: t('children.female') }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(g => g === opt.value ? '' : opt.value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-rubik font-medium text-sm transition-all active:scale-95',
                    gender === opt.value ? 'text-white' : 'bg-cream-200 text-brown-600'
                  )}
                  style={gender === opt.value ? { backgroundColor: '#5BAD6F' } : {}}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t('app.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
