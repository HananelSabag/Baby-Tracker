import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="pb-8">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => goBack(navigate, '/profile')}
          className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-brown-600 active:scale-95 transition-transform flex-shrink-0"
        >
          ›
        </button>
        <div>
          <h1 className="font-rubik font-bold text-xl text-brown-800">פרופיל משפחה</h1>
          <p className="font-rubik text-xs text-brown-400">מרכז שליטה משפחתי</p>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Family name */}
        <Card>
          <p className="text-xs font-medium text-brown-400 font-rubik mb-2">שם המשפחה</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={familyNameEdit}
              onChange={e => setFamilyNameEdit(e.target.value)}
              className="flex-1 bg-cream-100 rounded-2xl px-3 py-2.5 font-rubik text-brown-800 outline-none text-sm"
            />
            {familyNameEdit !== (family?.name ?? '') && (
              <Button onClick={handleSaveFamilyName} disabled={savingName} className="text-sm px-4 py-2 flex-shrink-0">
                {savingName ? '...' : 'שמור'}
              </Button>
            )}
          </div>
        </Card>

        {/* Children */}
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
              {children.map(child =>
                children.length === 1 ? (
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
                        <p className="text-xs text-brown-400 font-rubik">{new Date(child.birth_date).toLocaleDateString('he-IL')}</p>
                      )}
                    </div>
                    {isParent && (
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditChildTarget(child)} className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center text-sm active:scale-95 transition-transform">✏️</button>
                        <button onClick={() => setDeleteChildTarget(child)} className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-sm active:scale-95 transition-transform">🗑</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div key={child.id} className="bg-white rounded-2xl shadow-soft p-3 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center mb-2 flex-shrink-0">
                      {child.avatar_url
                        ? <img src={child.avatar_url} alt={child.name} className="w-full h-full object-cover" />
                        : <span className="text-2xl">👶</span>
                      }
                    </div>
                    <p className="font-rubik font-semibold text-brown-800 text-sm leading-tight">{child.name}</p>
                    {child.birth_date && (
                      <p className="text-xs text-brown-400 font-rubik mt-0.5">{new Date(child.birth_date).toLocaleDateString('he-IL')}</p>
                    )}
                    {isParent && (
                      <div className="flex gap-2 mt-2 w-full">
                        <button onClick={() => setEditChildTarget(child)} className="flex-1 py-1.5 rounded-xl bg-cream-100 text-sm active:scale-95 transition-transform">✏️</button>
                        <button onClick={() => setDeleteChildTarget(child)} className="flex-1 py-1.5 rounded-xl bg-red-50 text-sm active:scale-95 transition-transform">🗑</button>
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

          {/* Members */}
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

