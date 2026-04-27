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
  const currentInList = ROLES.find(r => r.value === identity.memberName)
  const [role, setRole] = useState(currentInList ? identity.memberName : 'אחר')
  const [customRole, setCustomRole] = useState(currentInList ? '' : (identity.memberName ?? ''))
  const [avatarUrl, setAvatarUrl] = useState(identity.memberAvatarUrl ?? identity.googleAvatarUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false)
  const [roleSheetOpen, setRoleSheetOpen] = useState(false)

  const isParent = PARENT_ROLES.includes(identity.memberName)
  const selectedRole = ROLES.find(r => r.value === role) ?? ROLES.find(r => r.value === 'אחר')

  // Roles already taken by OTHER members (אבא/אמא stay locked — intentional family protection)
  const takenByOthers = new Set(
    members.filter(m => m.id !== identity.memberId).map(m => m.role)
  )
  function isRoleLocked(roleValue) {
    return PARENT_ROLES.includes(roleValue) && takenByOthers.has(roleValue)
  }

  // Displayed role name in the compact row (show custom text when "אחר")
  const displayedRoleName = identity.memberName ?? 'אחר'
  const displayedRoleEmoji = (ROLES.find(r => r.value === identity.memberName) ?? ROLES.find(r => r.value === 'אחר')).emoji

  function handleCloseRoleSheet() {
    // Reset to current saved role on cancel
    const inList = ROLES.find(r => r.value === identity.memberName)
    setRole(inList ? identity.memberName : 'אחר')
    setCustomRole(inList ? '' : (identity.memberName ?? ''))
    setRoleSheetOpen(false)
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSaveRole() {
    setSaving(true)
    try {
      const displayName = role === 'אחר' ? (customRole.trim() || 'אחר') : role
      await updateMember(identity.memberId, { display_name: displayName, role: displayName, avatar_url: avatarUrl })
      saveIdentity({ familyId: identity.familyId, memberId: identity.memberId, memberName: displayName })
      setMemberAvatarUrl(avatarUrl)
      setRoleSheetOpen(false)
      showToast({ message: t('profile.profileSaved'), emoji: '✅' })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(mode) {
    setUploadStatus('uploading')
    try {
      const picked = await pickAndCompressImage({ mode })
      if (!picked) { setUploadStatus(null); return }
      const url = await uploadAvatar({ folder: 'members', subjectId: identity.memberId, ...picked })
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
    <div className="px-4 pt-6 pb-8 space-y-5">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Page title */}
      <h1 className="font-rubik font-bold text-2xl text-brown-800">הפרופיל שלי</h1>

      {/* ── My profile card ── */}
      <Card>
        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-4">
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

        {/* Role row */}
        <p className="text-xs font-medium text-brown-400 font-rubik mb-2">{t('profile.myRole')}</p>
        <div className="flex items-center gap-2 bg-cream-100 rounded-2xl px-4 py-3">
          <span className="text-xl">{displayedRoleEmoji}</span>
          <span className="font-rubik font-bold text-brown-800 text-base">{displayedRoleName}</span>
          <button
            onClick={() => setRoleSheetOpen(true)}
            className="mr-auto font-rubik text-amber-600 text-xs font-semibold border border-amber-300 rounded-full px-3 py-1 bg-white active:scale-95 transition-transform"
          >
            שנה
          </button>
        </div>
      </Card>

      {/* ── Settings group ── */}
      <div>
        <p className="text-xs font-semibold text-brown-400 font-rubik uppercase tracking-wider mb-2 px-1">הגדרות</p>
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          {isParent && (
            <>
              <button
                onClick={() => navigate('/family')}
                className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-cream-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">👨‍👩‍👧</div>
                <div className="flex-1 text-right min-w-0">
                  <p className="font-rubik font-semibold text-brown-800 text-sm">פרופיל משפחה</p>
                  <p className="font-rubik text-brown-400 text-xs mt-0.5">ילדים, חברי משפחה, קוד הצטרפות</p>
                </div>
                <span className="text-brown-300 text-lg flex-shrink-0">‹</span>
              </button>
              <div className="h-px bg-cream-100 mx-4" />
            </>
          )}
          <button
            onClick={() => navigate('/notifications')}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-cream-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">🔔</div>
            <div className="flex-1 text-right min-w-0">
              <p className="font-rubik font-semibold text-brown-800 text-sm">התראות</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">Push, מינונים, חיתול</p>
            </div>
            <span className="text-brown-300 text-lg flex-shrink-0">‹</span>
          </button>
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div>
        <p className="text-xs font-semibold text-brown-400 font-rubik uppercase tracking-wider mb-2 px-1">חשבון</p>
        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <button
            onClick={() => setSignOutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-red-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-lg flex-shrink-0">🚪</div>
            <div className="flex-1 text-right">
              <p className="font-rubik font-semibold text-red-500 text-sm">{t('profile.signOut')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Privacy — legal footnote */}
      <div className="text-center pb-1">
        <Link to="/privacy" className="font-rubik text-brown-300 text-xs active:opacity-60 transition-opacity">
          🔐 מדיניות פרטיות
        </Link>
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

      {/* Role selection sheet */}
      <BottomSheet isOpen={roleSheetOpen} onClose={handleCloseRoleSheet} title="שנה תפקיד">
        <div className="space-y-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {ROLES.map(r => {
              const locked = isRoleLocked(r.value)
              return (
                <button
                  key={r.value}
                  onClick={() => !locked && setRole(r.value)}
                  disabled={locked}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-2xl font-rubik text-sm font-medium transition-all active:scale-95',
                    locked ? 'opacity-35 cursor-not-allowed bg-cream-100 text-brown-400' :
                    role === r.value ? 'bg-amber-500 text-white shadow-soft' : 'bg-cream-100 text-brown-700'
                  )}
                >
                  <span>{r.emoji}</span>
                  {r.label}
                  {locked && <span className="text-xs">🔒</span>}
                </button>
              )
            })}
          </div>

          {role === 'אחר' && (
            <div className="space-y-3">
              <p className="text-xs text-brown-400 font-rubik">בחירה מהירה</p>
              <div className="flex flex-wrap gap-2">
                {['בייביסיטר', 'דוד', 'דודה', 'אח', 'אחות', 'חבר/ה'].map(quick => (
                  <button
                    key={quick}
                    onClick={() => setCustomRole(quick)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl font-rubik text-sm transition-all active:scale-95',
                      customRole === quick ? 'bg-brown-700 text-white' : 'bg-cream-200 text-brown-600'
                    )}
                  >
                    {quick}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                placeholder={t('setup.customRolePlaceholder')}
                className="w-full bg-cream-100 rounded-2xl px-4 py-2.5 font-rubik text-brown-800 outline-none text-sm"
              />
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSaveRole}
            disabled={saving || (role === 'אחר' && !customRole.trim())}
          >
            {saving ? t('app.loading') : 'שמור תפקיד'}
          </Button>
        </div>
      </BottomSheet>

      {/* Avatar sheet */}
      <BottomSheet isOpen={avatarSheetOpen} onClose={() => setAvatarSheetOpen(false)} hero>
        <div className="rounded-t-4xl overflow-hidden">
          {/* Floating handle */}
          <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
            <div className="w-10 h-1 bg-white/50 rounded-full" />
          </div>
          {/* Hero photo */}
          <div className="relative w-full h-72 bg-gradient-to-br from-amber-100 to-cream-200">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover object-center" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-40">{selectedRole?.emoji ?? '👤'}</span>
                </div>
            }
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/90 to-transparent" />
            <div className="absolute bottom-3 right-4 text-right">
              <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{user?.user_metadata?.full_name}</p>
              <p className="font-rubik text-brown-500 text-xs">{user?.email}</p>
            </div>
          </div>
          {/* Action button */}
          <div className="px-4 pt-4 pb-6">
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

