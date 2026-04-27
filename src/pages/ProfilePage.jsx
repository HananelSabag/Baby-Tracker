import { useState } from 'react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { updateMember, useFamilyMembers } from '../hooks/useFamily'
import { ROLES, ADMIN_EMAIL, PARENT_ROLES } from '../lib/constants'
import { useNavigate, Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastContainer } from '../components/ui/Toast'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'
import { pickAndCompressImage, uploadAvatar } from '../lib/imageUpload'

export function ProfilePage() {
  const { identity, user, signOut, saveIdentity, setMemberAvatarUrl } = useApp()
  const navigate = useNavigate()
  const isAdmin = user?.email === ADMIN_EMAIL
  const { toasts, showToast, dismissToast } = useToast()
  const members = useFamilyMembers(identity.familyId)

  // ── My profile state ──────────────────────────────────────────────────────
  const [role, setRole] = useState(identity.memberName ?? '')
  const [customRole, setCustomRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(identity.memberAvatarUrl ?? identity.googleAvatarUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false)

  const isParent = PARENT_ROLES.includes(identity.memberName)
  const selectedRole = ROLES.find(r => r.value === role) ?? ROLES.find(r => r.value === 'אחר')

  // Roles already taken by OTHER members (can't pick אמא/אבא if someone else has it)
  const takenByOthers = new Set(
    members.filter(m => m.id !== identity.memberId).map(m => m.role)
  )
  function isRoleLocked(roleValue) {
    return PARENT_ROLES.includes(roleValue) && takenByOthers.has(roleValue)
  }

  const isDirty = role !== (identity.memberName ?? '')

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const displayName = role === 'אחר' ? (customRole || 'אחר') : role
      await updateMember(identity.memberId, { display_name: displayName, role: displayName, avatar_url: avatarUrl })
      saveIdentity({ familyId: identity.familyId, memberId: identity.memberId, memberName: displayName })
      setMemberAvatarUrl(avatarUrl)
      showToast({ message: t('profile.profileSaved'), emoji: '✅' })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(mode) {
    setUploadStatus('uploading')
    try {
      const picked = await pickAndCompressImage({ mode })
      if (!picked) {
        setUploadStatus(null)
        return
      }
      const url = await uploadAvatar({
        folder: 'members',
        subjectId: identity.memberId,
        ...picked,
      })
      setAvatarUrl(url)
      setMemberAvatarUrl(url)
      await updateMember(identity.memberId, { avatar_url: url })
      setUploadStatus('success')
      setTimeout(() => setUploadStatus(null), 2500)
    } catch (err) {
      console.error('avatar upload failed:', err)
      setUploadStatus('error')
      setTimeout(() => setUploadStatus(null), 3000)
    }
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-4">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Profile card */}
      <Card>
        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-4">
          {/* Tappable avatar → opens sheet */}
          <button
            onClick={() => setAvatarSheetOpen(true)}
            className="relative flex-shrink-0 active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden bg-cream-200 shadow-soft ring-2 ring-cream-300">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl">{selectedRole?.emoji ?? '👤'}</div>
              }
            </div>
            <div className="absolute bottom-0 left-0 w-5 h-5 bg-brown-600 rounded-full flex items-center justify-center text-white text-[10px] shadow-soft">
              {uploadStatus === 'uploading' ? '⏳' : '📷'}
            </div>
          </button>
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
          {ROLES.map(r => {
            const locked = isRoleLocked(r.value)
            return (
              <button
                key={r.value}
                onClick={() => !locked && setRole(r.value)}
                disabled={locked}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl font-rubik text-sm font-medium transition-all',
                  locked ? 'opacity-35 cursor-not-allowed bg-cream-100 text-brown-400' :
                  role === r.value ? 'bg-amber-500 text-white shadow-soft active:scale-95' : 'bg-cream-100 text-brown-700 active:scale-95'
                )}
                title={locked ? 'תפקיד זה כבר נלקח על ידי חבר משפחה אחר' : undefined}
              >
                <span>{r.emoji}</span>
                {r.label}
                {locked && <span className="text-xs">🔒</span>}
              </button>
            )
          })}
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

        {/* Save button — only when dirty */}
        {isDirty && (
          <Button className="w-full mt-3" onClick={handleSave} disabled={saving}>
            {saving ? t('app.loading') : t('profile.saveChanges')}
          </Button>
        )}
      </Card>

      {/* Family profile shortcut — parents only */}
      {isParent && (
        <button
          onClick={() => navigate('/family')}
          className="w-full bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">👨‍👩‍👧</div>
            <div className="text-right">
              <p className="font-rubik font-semibold text-brown-800 text-sm">פרופיל משפחה</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">ילדים, חברי משפחה, קוד הצטרפות</p>
            </div>
          </div>
          <span className="text-brown-400 text-lg">‹</span>
        </button>
      )}

      {/* Notifications */}
      <button
        onClick={() => navigate('/notifications')}
        className="w-full bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center justify-between active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">🔔</div>
          <div className="text-right">
            <p className="font-rubik font-semibold text-brown-800 text-sm">הגדרות התראות</p>
            <p className="font-rubik text-brown-400 text-xs mt-0.5">Push, שעות מינונים, חיתול</p>
          </div>
        </div>
        <span className="text-brown-400 text-lg">‹</span>
      </button>

      <Link
        to="/privacy"
        className="flex items-center justify-center gap-2 w-full bg-white border border-cream-300 rounded-2xl py-3 font-rubik font-medium text-brown-500 text-sm shadow-soft active:scale-[0.99] transition-all"
      >
        🔐 מדיניות פרטיות
      </Link>

      <button
        onClick={() => setSignOutConfirm(true)}
        className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 rounded-2xl py-3.5 font-rubik font-semibold text-red-500 text-sm active:scale-[0.99] transition-all"
      >
        🚪 {t('profile.signOut')}
      </button>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        isOpen={signOutConfirm}
        message={t('profile.signOutConfirm')}
        onConfirm={signOut}
        onCancel={() => setSignOutConfirm(false)}
        confirmLabel={t('auth.signOut')}
        confirmVariant="secondary"
      />

      {/* Avatar sheet */}
      <BottomSheet isOpen={avatarSheetOpen} onClose={() => setAvatarSheetOpen(false)} title="">
        <div className="flex flex-col pb-2 -mx-4 -mt-2">
          <div className="relative w-full h-56 bg-gradient-to-br from-amber-100 to-cream-200 overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover object-center" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-40">{selectedRole?.emoji ?? '👤'}</span>
                </div>
            }
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/90 to-transparent" />
            <div className="absolute bottom-3 right-4 text-right">
              <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{user?.user_metadata?.full_name}</p>
              <p className="font-rubik text-brown-500 text-xs">{user?.email}</p>
            </div>
          </div>
          <div className="px-4 pt-4">
            <button
              onClick={() => { setAvatarSheetOpen(false); setPhotoSourceOpen(true) }}
              disabled={uploadStatus === 'uploading'}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-cream-100 active:bg-cream-200 transition-colors disabled:opacity-60"
            >
              <span className="text-lg">{uploadStatus === 'uploading' ? '⏳' : '📷'}</span>
              <span className="font-rubik font-medium text-brown-700 text-sm">שנה תמונה</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Camera vs gallery picker */}
      <PhotoSourceSheet
        isOpen={photoSourceOpen}
        onClose={() => setPhotoSourceOpen(false)}
        onPick={handleAvatarChange}
        title="תמונת פרופיל"
      />
    </div>
  )
}

