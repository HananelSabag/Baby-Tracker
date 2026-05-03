import { useState } from 'react'
import { Camera, ChevronLeft, ShieldCheck, Users, Bell, LogOut, Lock, Loader2 } from 'lucide-react'
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
    <div className="px-4 pt-8 pb-10 space-y-5">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Page title */}
      <div className="px-1">
        <h1 className="font-rubik font-bold text-3xl text-brown-800 leading-tight">הפרופיל שלי</h1>
        <p className="font-rubik text-brown-400 text-sm mt-0.5">{user?.email}</p>
      </div>

      {/* ── My profile card ── */}
      <Card>
        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={() => setAvatarSheetOpen(true)}
            className="relative flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
            aria-label="שנה תמונת פרופיל"
          >
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden bg-cream-200"
              style={{ boxShadow: '0 4px 16px rgba(61,43,31,0.14), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 3px #E8C9A8' }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-4xl">{selectedRole?.emoji ?? '👤'}</div>
              }
            </div>
            {/* Camera badge */}
            <div
              className="absolute -bottom-1 -left-1 w-7 h-7 rounded-xl flex items-center justify-center bg-brown-700 border-2 border-white"
              style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.25)' }}
            >
              {uploadStatus === 'uploading'
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <Camera size={13} className="text-white" />
              }
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <p className="font-rubik font-bold text-brown-800 text-lg leading-tight truncate">{user?.user_metadata?.full_name}</p>
            {uploadStatus === 'success' && <p className="text-xs text-green-600 font-rubik font-semibold mt-1">{t('profile.photoUploaded')}</p>}
            {uploadStatus === 'error' && <p className="text-xs text-red-500 font-rubik font-semibold mt-1">{t('profile.photoError')}</p>}
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-rubik font-bold text-brown-700 px-3 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform border border-brown-300"
                style={{ background: 'linear-gradient(135deg, #F5E6D3, #E8C9A8)', boxShadow: '0 2px 6px rgba(61,43,31,0.12)' }}
              >
                <ShieldCheck size={12} />
                {t('profile.admin')}
              </button>
            )}
          </div>
        </div>

        {/* Role row */}
        <p className="text-xs font-semibold text-brown-400 font-rubik mb-2 px-0.5">{t('profile.myRole')}</p>
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-cream-200"
          style={{ background: 'linear-gradient(135deg, #FFF8F0, #F5E6D3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
        >
          <span className="text-2xl leading-none">{displayedRoleEmoji}</span>
          <span className="font-rubik font-bold text-brown-800 text-base flex-1">{displayedRoleName}</span>
          <button
            onClick={() => setRoleSheetOpen(true)}
            className="font-rubik font-bold text-amber-700 text-xs px-3.5 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform border border-amber-300 bg-white"
            style={{ boxShadow: '0 2px 6px rgba(180,93,20,0.14)' }}
          >
            שנה
          </button>
        </div>
      </Card>

      {/* ── Settings group ── */}
      <div>
        <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest mb-2.5 px-1">הגדרות</p>
        <div
          className="bg-white rounded-3xl overflow-hidden border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          {isParent && (
            <>
              <button
                onClick={() => navigate('/family')}
                className="w-full flex items-center gap-3 px-4 min-h-[56px] cursor-pointer active:bg-cream-50 transition-colors duration-150"
              >
                <div
                  className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-100"
                  style={{ boxShadow: '0 2px 6px rgba(180,93,20,0.10)' }}
                >
                  <Users size={20} className="text-amber-600" />
                </div>
                <div className="flex-1 text-right min-w-0 py-3.5">
                  <p className="font-rubik font-bold text-brown-800 text-sm">פרופיל משפחה</p>
                  <p className="font-rubik text-brown-400 text-xs mt-0.5">ילדים, חברי משפחה, קוד הצטרפות</p>
                </div>
                <ChevronLeft size={18} className="text-brown-300 flex-shrink-0" />
              </button>
              <div className="h-px bg-cream-100 mx-4" />
            </>
          )}
          <button
            onClick={() => navigate('/notifications')}
            className="w-full flex items-center gap-3 px-4 min-h-[56px] cursor-pointer active:bg-cream-50 transition-colors duration-150"
          >
            <div
              className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 border border-amber-100"
              style={{ boxShadow: '0 2px 6px rgba(180,93,20,0.10)' }}
            >
              <Bell size={20} className="text-amber-600" />
            </div>
            <div className="flex-1 text-right min-w-0 py-3.5">
              <p className="font-rubik font-bold text-brown-800 text-sm">התראות</p>
              <p className="font-rubik text-brown-400 text-xs mt-0.5">Push, מינונים, חיתול</p>
            </div>
            <ChevronLeft size={18} className="text-brown-300 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* ── Account / danger zone ── */}
      <div>
        <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest mb-2.5 px-1">חשבון</p>
        <div
          className="bg-white rounded-3xl overflow-hidden border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          <button
            onClick={() => setSignOutConfirm(true)}
            className="w-full flex items-center gap-3 px-4 min-h-[56px] cursor-pointer active:bg-red-50 transition-colors duration-150"
          >
            <div
              className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0 border border-red-100"
              style={{ boxShadow: '0 2px 6px rgba(239,68,68,0.10)' }}
            >
              <LogOut size={20} className="text-red-400" />
            </div>
            <div className="flex-1 text-right py-3.5">
              <p className="font-rubik font-bold text-red-500 text-sm">{t('profile.signOut')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Privacy — legal footnote */}
      <div className="text-center pb-2">
        <Link
          to="/privacy"
          className="inline-flex items-center gap-1.5 font-rubik text-brown-300 text-xs cursor-pointer active:opacity-60 transition-opacity"
        >
          <Lock size={11} />
          מדיניות פרטיות
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
                    'flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-rubik text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer min-h-[44px]',
                    locked ? 'opacity-35 cursor-not-allowed bg-cream-100 text-brown-400' :
                    role === r.value
                      ? 'bg-amber-500 text-white border border-amber-600/20'
                      : 'bg-cream-100 text-brown-700 border border-cream-200'
                  )}
                  style={!locked && role === r.value ? { boxShadow: '0 4px 10px rgba(180,93,20,0.25), inset 0 1px 0 rgba(255,255,255,0.18)' } : undefined}
                >
                  <span>{r.emoji}</span>
                  {r.label}
                  {locked && <span className="text-xs opacity-70">🔒</span>}
                </button>
              )
            })}
          </div>

          {role === 'אחר' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-brown-400 font-rubik">בחירה מהירה</p>
              <div className="flex flex-wrap gap-2">
                {['בייביסיטר', 'דוד', 'דודה', 'אח', 'אחות', 'חבר/ה'].map(quick => (
                  <button
                    key={quick}
                    onClick={() => setCustomRole(quick)}
                    className={cn(
                      'px-3.5 py-2 rounded-xl font-rubik text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer min-h-[36px] border',
                      customRole === quick
                        ? 'bg-brown-700 text-white border-brown-800/20'
                        : 'bg-cream-100 text-brown-600 border-cream-200'
                    )}
                    style={customRole === quick ? { boxShadow: '0 3px 8px rgba(61,43,31,0.20)' } : undefined}
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
                className="w-full bg-cream-100 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-sm border border-cream-200 focus:border-amber-300 transition-colors duration-150"
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
          <div className="absolute top-3.5 left-0 right-0 flex justify-center pointer-events-none">
            <div className="w-12 h-1.5 bg-white/50 rounded-full" />
          </div>
          {/* Hero photo */}
          <div className="relative w-full h-72 bg-gradient-to-br from-amber-100 to-cream-200">
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover object-center" />
              : <div className="w-full h-full flex items-center justify-center">
                  <span className="text-8xl opacity-40">{selectedRole?.emoji ?? '👤'}</span>
                </div>
            }
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/95 to-transparent" />
            <div className="absolute bottom-4 right-4 text-right">
              <p className="font-rubik font-bold text-brown-800 text-2xl leading-tight">{user?.user_metadata?.full_name}</p>
              <p className="font-rubik text-brown-500 text-xs mt-0.5">{user?.email}</p>
            </div>
          </div>
          {/* Action button */}
          <div className="px-4 pt-4 pb-6">
            <button
              onClick={() => { setAvatarSheetOpen(false); setPhotoSourceOpen(true) }}
              disabled={uploadStatus === 'uploading'}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl cursor-pointer active:bg-cream-200 transition-colors duration-150 disabled:opacity-60 border border-cream-200 bg-cream-100 min-h-[52px]"
              style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.07), inset 0 1px 0 rgba(255,255,255,0.9)' }}
            >
              {uploadStatus === 'uploading'
                ? <Loader2 size={18} className="text-brown-500 animate-spin" />
                : <Camera size={18} className="text-brown-600" />
              }
              <span className="font-rubik font-semibold text-brown-700 text-sm">שנה תמונה</span>
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
