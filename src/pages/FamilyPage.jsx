import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Baby, Pencil, Trash2, RefreshCw,
  Copy, Check, Users, User, Plus, Loader2, UserMinus,
} from 'lucide-react'
import { goBack } from '../lib/utils'
import { t } from '../lib/strings'
import { useApp } from '../hooks/useAppContext'
import { useFamilyMembers, updateMember, updateFamily, removeMember } from '../hooks/useFamily'
import { useChildren, addChild } from '../hooks/useChildren'
import { generateFamilyCode } from '../lib/utils'
import { ROLES, PARENT_ROLES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ToastContainer } from '../components/ui/Toast'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { ChildFormSheet } from '../components/ui/ChildFormSheet'
import { useToast } from '../hooks/useToast'
import { cn } from '../lib/utils'
import { pickAndCompressImage, uploadAvatar } from '../lib/imageUpload'

export function FamilyPage() {
  const { identity } = useApp()
  const navigate = useNavigate()
  const members = useFamilyMembers(identity.familyId)
  const { children, updateChild, deleteChild } = useChildren(identity.familyId)
  const { toasts, showToast, dismissToast } = useToast()

  const [family, setFamily] = useState(null)
  const [familyNameEdit, setFamilyNameEdit] = useState('')
  const [copied, setCopied] = useState(false)
  const [refreshingCode, setRefreshingCode] = useState(false)
  const [failedAvatars, setFailedAvatars] = useState(new Set())
  const [savingName, setSavingName] = useState(false)

  const [addChildOpen, setAddChildOpen] = useState(false)
  const [editChildTarget, setEditChildTarget] = useState(null)
  const [deleteChildTarget, setDeleteChildTarget] = useState(null)
  const [removingMember, setRemovingMember] = useState(null)

  const isParent = PARENT_ROLES.includes(identity.memberName)

  // BUG FIX: previously this used `useState(() => {...})` as a side effect,
  // which is the wrong primitive and never re-runs if familyId changes.
  useEffect(() => {
    if (!identity.familyId) return
    let cancelled = false
    supabase.from('families').select().eq('id', identity.familyId).single()
      .then(({ data }) => {
        if (cancelled || !data) return
        setFamily(data)
        setFamilyNameEdit(data.name)
      })
    return () => { cancelled = true }
  }, [identity.familyId])

  async function handleSaveFamilyName() {
    if (!familyNameEdit.trim() || familyNameEdit === family?.name) return
    setSavingName(true)
    try {
      await updateFamily(identity.familyId, { name: familyNameEdit.trim() })
      setFamily(prev => ({ ...prev, name: familyNameEdit.trim() }))
      showToast({ message: 'שם המשפחה עודכן', emoji: '✅' })
    } finally {
      setSavingName(false)
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

  async function handleChildSave({ name, photo, birthDate, gender }, isEdit) {
    let uploadedUrl = isEdit ? editChildTarget.avatar_url : null
    // photo is { blob, ext, mime } from pickAndCompressImage, or null
    if (photo?.blob) {
      try {
        const subjectId = isEdit ? editChildTarget.id : `new-${Date.now()}`
        uploadedUrl = await uploadAvatar({
          folder: 'children',
          subjectId,
          ...photo,
        })
      } catch (err) {
        showToast({ message: 'העלאת התמונה נכשלה', emoji: '⚠️' })
        // Fall through — still save the rest of the changes
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
    <div className="pb-10">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="px-4 pt-8 pb-5 flex items-center gap-3">
        <button
          onClick={() => goBack(navigate, '/profile')}
          className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-brown-600 cursor-pointer active:scale-95 transition-transform flex-shrink-0 border border-cream-200"
          style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.9)' }}
          aria-label="חזור"
        >
          <ChevronRight size={20} />
        </button>
        <div>
          <h1 className="font-rubik font-bold text-3xl text-brown-800 leading-tight">פרופיל משפחה</h1>
          <p className="font-rubik text-sm text-brown-400 mt-0.5">מרכז שליטה משפחתי</p>
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* Family name */}
        <Card>
          <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest mb-3">שם המשפחה</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={familyNameEdit}
              onChange={e => setFamilyNameEdit(e.target.value)}
              className="flex-1 bg-cream-50 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none text-sm border border-cream-200 focus:border-amber-300 transition-colors duration-150"
            />
            {familyNameEdit !== (family?.name ?? '') && (
              <Button onClick={handleSaveFamilyName} disabled={savingName} size="sm" className="flex-shrink-0">
                {savingName ? <Loader2 size={14} className="animate-spin" /> : 'שמור'}
              </Button>
            )}
          </div>
        </Card>

        {/* Children */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Baby size={13} className="text-brown-400" />
              <p className="font-rubik font-bold text-brown-400 text-xs uppercase tracking-widest">{t('profile.childrenSection')}</p>
            </div>
            {isParent && (
              <button
                onClick={() => setAddChildOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm font-rubik font-bold text-white bg-amber-600 px-3.5 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform border border-amber-700/20 min-h-[36px]"
                style={{ boxShadow: '0 4px 12px rgba(180,93,20,0.28), inset 0 1px 0 rgba(255,255,255,0.18)' }}
              >
                <Plus size={14} />
                {t('profile.addChildButton')}
              </button>
            )}
          </div>

          {children.length === 0 ? (
            <button
              onClick={() => isParent && setAddChildOpen(true)}
              className="w-full py-8 rounded-3xl border-2 border-dashed border-cream-300 text-brown-400 font-rubik text-sm text-center cursor-pointer active:border-amber-300 transition-colors duration-150 bg-white/50"
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-12 h-12 rounded-2xl bg-cream-100 flex items-center justify-center border border-cream-200"
                  style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.06)' }}
                >
                  <Baby size={24} className="text-brown-300" />
                </div>
                <span className="font-semibold">{t('children.noChildren')}</span>
              </div>
            </button>
          ) : (
            <div className={cn('gap-3', children.length === 1 ? 'flex flex-col' : 'grid grid-cols-2')}>
              {children.map(child =>
                children.length === 1 ? (
                  <div
                    key={child.id}
                    className="bg-white rounded-3xl px-4 py-3.5 flex items-center gap-3 border border-cream-200"
                    style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl overflow-hidden bg-cream-200 flex items-center justify-center flex-shrink-0 border border-cream-300"
                      style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.10)' }}
                    >
                      {child.avatar_url
                        ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                        : <Baby size={26} className="text-brown-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-rubik font-bold text-brown-800 text-base">{child.name}</p>
                      {child.birth_date && (
                        <p className="text-xs text-brown-400 font-rubik mt-0.5">{new Date(child.birth_date).toLocaleDateString('he-IL')}</p>
                      )}
                    </div>
                    {isParent && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditChildTarget(child)}
                          className="w-10 h-10 rounded-2xl bg-cream-100 flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-cream-200"
                          style={{ boxShadow: '0 2px 6px rgba(61,43,31,0.07)' }}
                          aria-label="ערוך"
                        >
                          <Pencil size={15} className="text-brown-500" />
                        </button>
                        <button
                          onClick={() => setDeleteChildTarget(child)}
                          className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-red-100"
                          style={{ boxShadow: '0 2px 6px rgba(239,68,68,0.08)' }}
                          aria-label="מחק"
                        >
                          <Trash2 size={15} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    key={child.id}
                    className="bg-white rounded-3xl p-4 flex flex-col items-center text-center border border-cream-200"
                    style={{ boxShadow: '0 4px 20px rgba(61,43,31,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl overflow-hidden bg-cream-200 flex items-center justify-center mb-2.5 flex-shrink-0 border border-cream-300"
                      style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.10)' }}
                    >
                      {child.avatar_url
                        ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                        : <Baby size={26} className="text-brown-300" />
                      }
                    </div>
                    <p className="font-rubik font-bold text-brown-800 text-sm leading-tight">{child.name}</p>
                    {child.birth_date && (
                      <p className="text-xs text-brown-400 font-rubik mt-0.5">{new Date(child.birth_date).toLocaleDateString('he-IL')}</p>
                    )}
                    {isParent && (
                      <div className="flex gap-2 mt-3 w-full">
                        <button
                          onClick={() => setEditChildTarget(child)}
                          className="flex-1 py-2 rounded-xl bg-cream-100 flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-cream-200 min-h-[36px]"
                          aria-label="ערוך"
                        >
                          <Pencil size={14} className="text-brown-500" />
                        </button>
                        <button
                          onClick={() => setDeleteChildTarget(child)}
                          className="flex-1 py-2 rounded-xl bg-red-50 flex items-center justify-center cursor-pointer active:scale-95 transition-transform border border-red-100 min-h-[36px]"
                          aria-label="מחק"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Family code + members */}
        <Card>
          {/* Code row */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest mb-1">{t('profile.familyCode')}</p>
              <p
                className="font-rubik font-bold text-3xl tracking-[0.22em] text-brown-800"
                style={{ letterSpacing: '0.22em' }}
              >
                {family?.code ?? '···'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isParent && (
                <button
                  onClick={handleRefreshCode}
                  disabled={refreshingCode}
                  className="w-10 h-10 rounded-2xl bg-cream-100 flex items-center justify-center text-brown-500 cursor-pointer active:scale-95 transition-transform disabled:opacity-40 border border-cream-200"
                  style={{ boxShadow: '0 2px 6px rgba(61,43,31,0.07)' }}
                  aria-label="רענן קוד"
                >
                  {refreshingCode
                    ? <Loader2 size={16} className="animate-spin" />
                    : <RefreshCw size={16} />
                  }
                </button>
              )}
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 font-rubik font-bold text-sm text-brown-700 bg-cream-100 px-4 py-2.5 rounded-2xl cursor-pointer active:scale-95 transition-all duration-150 border border-cream-200 min-h-[40px]"
                style={{ boxShadow: copied ? '0 2px 8px rgba(34,197,94,0.20)' : '0 2px 6px rgba(61,43,31,0.07)' }}
              >
                {copied
                  ? <><Check size={14} className="text-green-500" /> {t('common.copied')}</>
                  : <><Copy size={14} /> {t('common.copy')}</>
                }
              </button>
            </div>
          </div>
          <p className="text-xs text-brown-400 font-rubik mb-5">{t('profile.familyCodeHint')}</p>

          {/* Members */}
          <div className="border-t border-cream-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} className="text-brown-400" />
              <p className="text-xs font-bold text-brown-400 font-rubik uppercase tracking-widest">{t('profile.members')}</p>
            </div>
            <div className="flex flex-wrap gap-4">
              {members.map(m => (
                <div key={m.id} className="flex flex-col items-center gap-1.5 relative">
                  <div
                    className="w-12 h-12 rounded-2xl overflow-hidden bg-cream-200 flex items-center justify-center border border-cream-300"
                    style={{ boxShadow: '0 2px 8px rgba(61,43,31,0.10)' }}
                  >
                    {m.avatar_url && !failedAvatars.has(m.id)
                      ? <img
                          src={m.avatar_url}
                          alt={m.display_name}
                          className="w-full h-full object-cover"
                          onError={() => setFailedAvatars(prev => new Set([...prev, m.id]))}
                        />
                      : <span className="text-lg">{ROLES.find(r => r.value === m.role)?.emoji ?? '👤'}</span>
                    }
                  </div>
                  <p className="font-rubik font-medium text-brown-700 text-xs">{m.display_name}</p>
                  {m.id === identity.memberId && (
                    <span className="text-[10px] text-amber-500 font-rubik font-bold -mt-1">{t('profile.you')}</span>
                  )}
                  {isParent && m.id !== identity.memberId && (
                    <button
                      onClick={() => setRemovingMember(m)}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-400 cursor-pointer active:scale-95 transition-transform border border-red-200"
                      style={{ boxShadow: '0 1px 4px rgba(239,68,68,0.15)' }}
                      aria-label={`הסר את ${m.display_name}`}
                    >
                      <UserMinus size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Dialogs */}
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

      <ChildFormSheet
        isOpen={addChildOpen}
        onClose={() => setAddChildOpen(false)}
        title={t('children.addChild')}
        onSave={data => handleChildSave(data, false)}
      />
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
