import { useState } from 'react'
import {
  Camera, ChevronLeft, ShieldCheck, Users, Bell, LogOut, Lock,
  Loader2, Accessibility, Pencil,
} from 'lucide-react'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { updateMember, useFamilyMembers } from '../hooks/useFamily'
import { ROLES, ADMIN_EMAIL, PARENT_ROLES } from '../lib/constants'
import { useNavigate, Link } from 'react-router-dom'
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
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false)
  const [roleSheetOpen, setRoleSheetOpen] = useState(false)

  const isParent = PARENT_ROLES.includes(identity.memberName)
  const selectedRole = ROLES.find(r => r.value === role) ?? ROLES.find(r => r.value === 'אחר')
  const displayedRole = ROLES.find(r => r.value === identity.memberName) ?? ROLES.find(r => r.value === 'אחר')

  const takenByOthers = new Set(
    members.filter(m => m.id !== identity.memberId).map(m => m.role)
  )
  function isRoleLocked(roleValue) {
    return PARENT_ROLES.includes(roleValue) && takenByOthers.has(roleValue)
  }

  function handleCloseRoleSheet() {
    const inList = ROLES.find(r => r.value === identity.memberName)
    setRole(inList ? identity.memberName : 'אחר')
    setCustomRole(inList ? '' : (identity.memberName ?? ''))
    setRoleSheetOpen(false)
  }

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
    } catch {
      setUploadStatus('error')
      setTimeout(() => setUploadStatus(null), 3000)
    }
  }

  return (
    <div className="px-4 pt-8 pb-10 space-y-5" dir="rtl">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Hero profile card ── */}
      <div
        className="relative rounded-3xl overflow-hidden border border-cream-200"
        style={{ boxShadow: '0 8px 32px rgba(61,43,31,0.12), inset 0 1px 0 rgba(255,255,255,0.9)' }}
      >
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(145deg, #FFF8F0 0%, #F5E6D3 50%, #EDD5B8 100%)' }}
        />

        {/* Decorative circle */}
        <div
          className="absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #D4A030 0%, transparent 70%)' }}
        />

        <div className="relative px-5 pt-6 pb-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <button
              onClick={() => setPhotoSourceOpen(true)}
              className="relative flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
              aria-label="שנה תמונת פרופיל"
            >
              <div
                className="w-24 h-24 rounded-3xl overflow-hidden bg-cream-200"
                style={{
                  boxShadow: '0 6px 20px rgba(61,43,31,0.18), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 3px #E8C9A8',
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-5xl">{selectedRole?.emoji ?? '👤'}</div>
                }
              </div>
              {/* Camera badge */}
              <div
                className="absolute -bottom-1 -left-1 w-8 h-8 rounded-2xl flex items-center justify-center border-2 border-white"
                style={{ background: 'linear-gradient(135deg, #A07050, #8B5E3C)', boxShadow: '0 3px 10px rgba(61,43,31,0.25)' }}
              >
                {uploadStatus === 'uploading'
                  ? <Loader2 size={14} className="text-white animate-spin" />
                  : <Camera size={14} className="text-white" />
                }
              </div>
            </button>

            {/* Name + info */}
            <div className="flex-1 min-w-0">
              <p className="font-rubik font-black text-brown-800 text-xl leading-tight truncate">
                {user?.user_metadata?.full_name}
              </p>
              <p className="font-rubik text-brown-500 text-xs mt-0.5 truncate">{user?.email}</p>

              {/* Role badge */}
              <button
                onClick={() => setRoleSheetOpen(true)}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform border border-amber-200"
                style={{
                  background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                  boxShadow: '0 2px 6px rgba(180,93,20,0.14)',
                }}
              >
                <span className="text-sm leading-none">{displayedRole?.emoji ?? '👤'}</span>
                <span className="font-rubik font-bold text-amber-800 text-xs">{identity.memberName ?? 'אחר'}</span>
                <Pencil size={10} className="text-amber-600 opacity-70" />
              </button>

              {uploadStatus === 'success' && (
                <p className="text-xs text-green-600 font-rubik font-semibold mt-1">{t('profile.photoUploaded')}</p>
              )}
              {uploadStatus === 'error' && (
                <p className="text-xs text-red-500 font-rubik font-semibold mt-1">{t('profile.photoError')}</p>
              )}
            </div>
          </div>

          {/* Admin badge */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform border border-brown-300"
              style={{
                background: 'linear-gradient(135deg, #F5E6D3, #E8C9A8)',
                boxShadow: '0 2px 8px rgba(61,43,31,0.12)',
              }}
            >
              <ShieldCheck size={14} className="text-brown-700" />
              <span className="font-rubik font-bold text-brown-700 text-sm">{t('profile.admin')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Settings group ── */}
      <div>
        <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest mb-2.5 px-1">הגדרות</p>
        <div
          className="bg-white rounded-3xl overflow-hidden border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          {isParent && (
            <>
              <SettingsRow
                icon={<Users size={20} className="text-amber-600" />}
                iconBg="bg-amber-50"
                iconBorder="border-amber-100"
                label="פרופיל משפחה"
                sub="ילדים, חברי משפחה, קוד הצטרפות"
                onClick={() => navigate('/family')}
              />
              <Divider />
            </>
          )}
          <SettingsRow
            icon={<Bell size={20} className="text-amber-600" />}
            iconBg="bg-amber-50"
            iconBorder="border-amber-100"
            label="התראות"
            sub="Push, מינונים, חיתול"
            onClick={() => navigate('/notifications')}
          />
          <Divider />
          <SettingsRow
            icon={<Accessibility size={20} className="text-blue-500" />}
            iconBg="bg-blue-50"
            iconBorder="border-blue-100"
            label="נגישות"
            sub="גודל טקסט, ניגודיות, תנועה"
            onClick={() => navigate('/accessibility')}
          />
        </div>
      </div>

      {/* ── Account / danger zone ── */}
      <div>
        <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest mb-2.5 px-1">חשבון</p>
        <div
          className="bg-white rounded-3xl overflow-hidden border border-cream-200"
          style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          <SettingsRow
            icon={<LogOut size={20} className="text-red-400" />}
            iconBg="bg-red-50"
            iconBorder="border-red-100"
            label={t('profile.signOut')}
            labelClass="text-red-500"
            hoverBg="active:bg-red-50"
            onClick={() => setSignOutConfirm(true)}
          />
        </div>
      </div>

      {/* Privacy + version footnote */}
      <div className="flex flex-col items-center gap-1.5 pb-2">
        <Link
          to="/privacy"
          className="inline-flex items-center gap-1.5 font-rubik text-brown-300 text-xs cursor-pointer active:opacity-60 transition-opacity"
        >
          <Lock size={11} />
          מדיניות פרטיות
        </Link>
        <p className="font-rubik text-brown-200 text-[11px]">גרסה 1.0.0</p>
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
                    locked
                      ? 'opacity-35 cursor-not-allowed bg-cream-100 text-brown-400'
                      : role === r.value
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

// ── Reusable settings row ────────────────────────────────────────────────────

function SettingsRow({ icon, iconBg, iconBorder, label, sub, onClick, labelClass, hoverBg = 'active:bg-cream-50' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 min-h-[60px] transition-colors duration-150 cursor-pointer text-right',
        hoverBg,
      )}
    >
      <div
        className={cn('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border', iconBg, iconBorder)}
        style={{ boxShadow: '0 2px 6px rgba(61,43,31,0.08)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 py-3.5">
        <p className={cn('font-rubik font-bold text-sm', labelClass ?? 'text-brown-800')}>{label}</p>
        {sub && <p className="font-rubik text-brown-400 text-xs mt-0.5">{sub}</p>}
      </div>
      <ChevronLeft size={18} className="text-brown-300 flex-shrink-0" />
    </button>
  )
}

function Divider() {
  return <div className="h-px bg-cream-100 mx-4" />
}
