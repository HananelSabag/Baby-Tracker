import { useState } from 'react'
import { t } from '../lib/strings'
import { ROLES, PARENT_ROLES } from '../lib/constants'
import { createFamily, joinFamily, lookupFamilyByCode } from '../hooks/useFamily'
import { addChild } from '../hooks/useChildren'
import { useApp } from '../hooks/useAppContext'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'
import { PhotoSourceSheet } from '../components/ui/PhotoSourceSheet'
import { pickAndCompressImage, uploadAvatar } from '../lib/imageUpload'

// Join path:   CHOOSE → CODE_JOIN → ROLE_JOIN  (then handleJoin)
// Create path: CHOOSE → ROLE_AND_NAME → CHILD → DONE
const STEPS = {
  CHOOSE:       'choose',
  CODE_JOIN:    'code_join',
  ROLE_JOIN:    'role_join',
  ROLE_AND_NAME:'role_and_name',
  CHILD:        'child',
  DONE:         'done',
}

export function SetupPage() {
  const { user, onFamilyJoined } = useApp()
  const { toasts, showToast, dismissToast } = useToast()
  const [codeCopied, setCodeCopied]     = useState(false)
  const [step, setStep]                 = useState(STEPS.CHOOSE)
  const [action, setAction]             = useState(null)
  const [role, setRole]                 = useState('')
  const [customRole, setCustomRole]     = useState('')
  const [familyName, setFamilyName]     = useState('')
  const [code, setCode]                 = useState('')
  const [createdCode, setCreatedCode]   = useState('')
  const [foundFamily, setFoundFamily]   = useState(null)   // from lookupFamilyByCode
  const [codeValidating, setCodeValidating] = useState(false)

  // Pending data — filled after CHILD step, used in DONE step
  const [pendingFamily, setPendingFamily]   = useState(null)
  const [pendingMember, setPendingMember]   = useState(null)
  const [pendingChildId, setPendingChildId] = useState(null)
  const [childName, setChildName]           = useState('')
  const [childAvatar, setChildAvatar]       = useState(null)        // preview URL
  const [childPhoto, setChildPhoto]         = useState(null)        // { blob, ext, mime }
  const [childBirthDate, setChildBirthDate] = useState('')
  const [childGender, setChildGender]       = useState('')
  const [error, setError]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false)
  const [photoBusy, setPhotoBusy]           = useState(false)

  const avatarUrl  = user?.user_metadata?.avatar_url ?? null
  const googleName = user?.user_metadata?.full_name ?? ''

  // Roles already taken by existing family members (for join path)
  const takenRoles = foundFamily?.taken_roles ?? []
  // A parent role is selectable only if not already taken
  function isRoleDisabled(roleValue) {
    return PARENT_ROLES.includes(roleValue) && takenRoles.includes(roleValue)
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goBack() {
    setError('')
    if      (step === STEPS.ROLE_AND_NAME) { setStep(STEPS.CHOOSE) }
    else if (step === STEPS.CODE_JOIN)     { setStep(STEPS.CHOOSE) }
    else if (step === STEPS.ROLE_JOIN)     { setRole(''); setStep(STEPS.CODE_JOIN) }
    else if (step === STEPS.CHILD)         { setStep(STEPS.ROLE_AND_NAME) }
  }

  function handleChoose(act) {
    setAction(act)
    setRole('')
    setError('')
    setStep(act === 'create' ? STEPS.ROLE_AND_NAME : STEPS.CODE_JOIN)
  }

  // ── Join path: step 1 — enter code ────────────────────────────────────────
  async function handleCodeContinue() {
    if (code.length !== 6) { setError(t('setup.codeError')); return }
    setCodeValidating(true)
    setError('')
    try {
      const result = await lookupFamilyByCode(code)
      if (!result) { setError(t('setup.codeError')); return }
      setFoundFamily(result)
      setRole('')
      setStep(STEPS.ROLE_JOIN)
    } catch {
      setError(t('setup.codeError'))
    } finally {
      setCodeValidating(false)
    }
  }

  // ── Join path: step 2 — pick role then join ────────────────────────────────
  async function handleJoin() {
    if (!role) { setError(t('setup.roleRequired')); return }
    if (isRoleDisabled(role)) { setError(t('errors.roleTaken')); return }
    setLoading(true)
    setError('')
    try {
      const { family, member } = await joinFamily({
        familyId:   foundFamily.family_id,
        familyCode: foundFamily.family_code,
        role,
        customRole,
        authUserId: user.id,
        avatarUrl,
      })
      const { data: existingChildren } = await supabase
        .from('children').select('id').eq('family_id', family.id)
        .order('created_at', { ascending: true }).limit(1)
      const childId = existingChildren?.[0]?.id ?? null
      onFamilyJoined({ family, member, childId })
    } catch (err) {
      if (err.message === 'family_full') setError(t('errors.familyFull'))
      else if (err.message === 'role_taken') setError(t('errors.roleTaken'))
      else setError(t('setup.codeError'))
    } finally {
      setLoading(false)
    }
  }

  // ── Create path: role + family name → CHILD ────────────────────────────────
  function handleRoleAndNameContinue() {
    if (!role) { setError(t('setup.roleRequired')); return }
    if (!familyName.trim()) { setError(t('setup.nameRequired')); return }
    setError('')
    setStep(STEPS.CHILD)
  }

  // ── Create path: avatar pick (camera or gallery) ───────────────────────────
  async function handlePickAvatar(mode) {
    setPhotoBusy(true)
    try {
      const picked = await pickAndCompressImage({ mode })
      if (!picked) return
      setChildPhoto(picked)
      setChildAvatar(URL.createObjectURL(picked.blob))
    } catch (err) {
      setError(err?.message ?? 'העלאת התמונה נכשלה')
    } finally {
      setPhotoBusy(false)
    }
  }

  // ── Create path: create family + child → DONE ──────────────────────────────
  async function handleChildSave() {
    const finalChildName = childName.trim() || 'תינוקי שלי'
    setLoading(true)
    setError('')
    try {
      let uploadedUrl = null
      if (childPhoto?.blob) {
        try {
          uploadedUrl = await uploadAvatar({
            folder: 'children',
            subjectId: `new-${Date.now()}`,
            ...childPhoto,
          })
        } catch (uploadErr) {
          setError(`שגיאת העלאת תמונה: ${uploadErr?.message ?? 'unknown'}`)
          setLoading(false)
          return
        }
      }

      let family, member
      try {
        ;({ family, member } = await createFamily({ familyName: familyName.trim(), role, customRole, authUserId: user.id, avatarUrl }))
      } catch (e) {
        setError(`שגיאת יצירת משפחה: ${e?.message ?? JSON.stringify(e)}`)
        setLoading(false)
        return
      }

      let child
      try {
        child = await addChild({ familyId: family.id, name: finalChildName, avatarUrl: uploadedUrl, birthDate: childBirthDate || null, gender: childGender || null })
      } catch (e) {
        setError(`שגיאת הוספת ילד: ${e?.message ?? JSON.stringify(e)}`)
        setLoading(false)
        return
      }

      setCreatedCode(family.code)
      setPendingFamily(family)
      setPendingMember(member)
      setPendingChildId(child.id)
      showToast({ message: t('setup.childAdded', { name: finalChildName }), emoji: '👶' })
      setStep(STEPS.DONE)
    } catch (e) {
      setError(`שגיאה לא צפויה: ${e?.message ?? JSON.stringify(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const showBack = step !== STEPS.CHOOSE && step !== STEPS.DONE

  function getStepProgress() {
    if (step === STEPS.CHOOSE || step === STEPS.DONE) return null
    const steps = action === 'create'
      ? [STEPS.ROLE_AND_NAME, STEPS.CHILD]
      : [STEPS.CODE_JOIN, STEPS.ROLE_JOIN]
    const idx = steps.indexOf(step)
    if (idx === -1) return null
    return { current: idx, total: steps.length }
  }
  const stepProgress = getStepProgress()

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="w-full max-w-[480px] min-h-screen flex flex-col px-6 py-10">

        {/* Back button */}
        {showBack && (
          <button
            onClick={goBack}
            className="self-start mb-4 flex items-center gap-1 text-brown-500 font-rubik text-sm py-2 active:scale-95 transition-transform"
          >
            ← {t('common.back')}
          </button>
        )}

        {/* User greeting */}
        {googleName && (
          <div className="flex items-center gap-3 mb-6">
            {avatarUrl
              ? <img src={avatarUrl} alt={googleName} className="w-10 h-10 rounded-full object-cover" />
              : <div className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center text-xl">👤</div>
            }
            <p className="font-rubik text-brown-600 text-sm">{t('setup.helloUser', { name: googleName })}</p>
          </div>
        )}

        {/* Step progress dots */}
        {stepProgress && (
          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: stepProgress.total }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepProgress.current ? 'w-6 bg-amber-500' :
                  i < stepProgress.current  ? 'w-3 bg-amber-300' :
                                              'w-3 bg-cream-300'
                }`}
              />
            ))}
          </div>
        )}

        {/* ── CHOOSE ─────────────────────────────────────────────────────────── */}
        {step === STEPS.CHOOSE && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🍼</div>
              <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('setup.createOrJoin')}</h1>
              <p className="font-rubik text-brown-400 text-sm mt-1">{t('setup.welcomeSubtitle')}</p>
            </div>

            <button
              onClick={() => handleChoose('create')}
              className="w-full rounded-3xl bg-white shadow-card overflow-hidden active:scale-[0.98] transition-transform text-right"
            >
              <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl flex-shrink-0">✨</div>
                <div className="flex-1 min-w-0">
                  <p className="font-rubik font-bold text-brown-800 text-lg">{t('setup.createFamily')}</p>
                  <p className="font-rubik text-brown-400 text-sm mt-0.5">{t('setup.createFamilyDesc')}</p>
                </div>
                <span className="text-brown-300 text-2xl flex-shrink-0">›</span>
              </div>
            </button>

            <button
              onClick={() => handleChoose('join')}
              className="w-full rounded-3xl bg-white shadow-soft overflow-hidden active:scale-[0.98] transition-transform text-right"
            >
              <div className="h-1.5 bg-gradient-to-r from-brown-400 to-brown-600" />
              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cream-200 flex items-center justify-center text-3xl flex-shrink-0">🔗</div>
                <div className="flex-1 min-w-0">
                  <p className="font-rubik font-bold text-brown-800 text-lg">{t('setup.joinFamily')}</p>
                  <p className="font-rubik text-brown-400 text-sm mt-0.5">{t('setup.joinFamilyDesc')}</p>
                </div>
                <span className="text-brown-300 text-2xl flex-shrink-0">›</span>
              </div>
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-4 self-center text-sm font-rubik text-brown-400 hover:text-brown-600 transition-colors"
            >
              {t('auth.signOut')}
            </button>
          </div>
        )}

        {/* ── CODE_JOIN — enter code first ────────────────────────────────────── */}
        {step === STEPS.CODE_JOIN && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">🔗</div>
              <h2 className="font-rubik font-bold text-xl text-brown-800">{t('setup.enterCodeTitle')}</h2>
            </div>

            {/* How-to instruction card */}
            <div className="bg-white rounded-2xl shadow-soft px-4 py-4 flex gap-3">
              <span className="text-2xl flex-shrink-0 mt-0.5">💡</span>
              <p className="font-rubik text-brown-500 text-sm leading-relaxed">{t('setup.enterCodeHint')}</p>
            </div>

            {/* Code input */}
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              placeholder={t('setup.codePlaceholder')}
              className="w-full bg-white text-center text-3xl font-bold font-rubik tracking-[0.5em] rounded-2xl py-5 shadow-soft outline-none text-brown-800 uppercase focus:ring-2 focus:ring-amber-400"
              autoFocus
            />

            {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}

            <Button className="w-full" size="lg" onClick={handleCodeContinue} disabled={codeValidating || code.length !== 6}>
              {codeValidating ? t('setup.codeValidating') : t('setup.continue')}
            </Button>
          </div>
        )}

        {/* ── ROLE_JOIN — pick role after code validated ───────────────────────── */}
        {step === STEPS.ROLE_JOIN && (
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div className="text-center mb-1">
              <h2 className="font-rubik font-bold text-xl text-brown-800">{t('setup.chooseRole')}</h2>
              {foundFamily && (
                <p className="font-rubik text-brown-400 text-sm mt-1">
                  {t('setup.chooseRoleSubtitle', { name: foundFamily.family_name })}
                </p>
              )}
            </div>

            {ROLES.map(r => {
              const disabled = isRoleDisabled(r.value)
              const selected = role === r.value
              return (
                <button
                  key={r.value}
                  onClick={() => { if (!disabled) { setRole(r.value); setError('') } }}
                  disabled={disabled}
                  className={cn(
                    'w-full flex items-center gap-4 py-4 px-5 rounded-2xl font-rubik font-medium text-lg transition-all active:scale-95',
                    disabled  ? 'bg-cream-200 text-brown-300 cursor-not-allowed opacity-60' :
                    selected  ? 'bg-amber-500 text-white shadow-soft' :
                                'bg-white shadow-card text-brown-800'
                  )}
                >
                  <span className="text-2xl">{r.emoji}</span>
                  <span className="flex-1 text-right">{r.label}</span>
                  {disabled && (
                    <span className="text-xs font-rubik font-semibold bg-brown-200 text-brown-500 px-2 py-0.5 rounded-full">
                      {t('setup.roleTakenBadge')}
                    </span>
                  )}
                  {selected && !disabled && <span className="text-white font-bold text-xl">✓</span>}
                </button>
              )
            })}

            {role === 'אחר' && (
              <input
                type="text"
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
                placeholder={t('setup.customRolePlaceholder')}
                className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 outline-none mt-1"
                autoFocus
              />
            )}

            {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}

            <Button className="w-full mt-2" size="lg" onClick={handleJoin} disabled={loading || !role}>
              {loading ? t('app.loading') : t('setup.join')}
            </Button>
          </div>
        )}

        {/* ── ROLE_AND_NAME — create path ─────────────────────────────────────── */}
        {step === STEPS.ROLE_AND_NAME && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div>
              <h2 className="font-rubik font-bold text-xl text-brown-800 text-center mb-3">{t('setup.chooseRole')}</h2>
              <div className="space-y-2">
                {ROLES.filter(r => PARENT_ROLES.includes(r.value)).map(r => (
                  <button
                    key={r.value}
                    onClick={() => { setRole(r.value); setError('') }}
                    className={cn(
                      'w-full flex items-center gap-4 py-3 px-5 rounded-2xl font-rubik font-medium text-base transition-all active:scale-95',
                      role === r.value ? 'bg-amber-500 text-white shadow-soft' : 'bg-white shadow-card text-brown-800'
                    )}
                  >
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="flex-1 text-right">{r.label}</span>
                    {role === r.value && <span className="text-white font-bold text-xl">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-cream-300" />

            <div>
              <h2 className="font-rubik font-bold text-lg text-brown-800 text-center mb-2">{t('setup.familyName')}</h2>
              <input
                type="text"
                value={familyName}
                onChange={e => { setFamilyName(e.target.value); setError('') }}
                placeholder={t('setup.familyNamePlaceholder')}
                className="w-full bg-white rounded-2xl shadow-soft px-5 py-4 font-rubik text-brown-800 text-lg outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleRoleAndNameContinue}>
              {t('setup.continue')}
            </Button>
          </div>
        )}

        {/* ── CHILD — create path ──────────────────────────────────────────────── */}
        {step === STEPS.CHILD && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">👶</div>
              <h2 className="font-rubik font-bold text-xl text-brown-800">{t('setup.addFirstChild')}</h2>
              <p className="font-rubik text-brown-400 text-sm mt-1">{t('setup.addChildSubtitle')}</p>
              <p className="font-rubik text-brown-300 text-xs mt-1">{t('setup.childStepOptional')}</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setPhotoSourceOpen(true)}
                disabled={photoBusy}
                className="w-24 h-24 rounded-full bg-cream-200 shadow-soft flex items-center justify-center overflow-hidden active:scale-95 transition-transform border-4 border-white disabled:opacity-60"
              >
                {photoBusy
                  ? <span className="text-3xl">⏳</span>
                  : childAvatar
                    ? <img src={childAvatar} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-5xl">👶</span>
                }
              </button>
              <button onClick={() => setPhotoSourceOpen(true)} disabled={photoBusy} className="text-xs font-rubik text-brown-500 bg-cream-200 px-4 py-2 rounded-full disabled:opacity-60">
                {t('children.addPhoto')}
              </button>
              <PhotoSourceSheet
                isOpen={photoSourceOpen}
                onClose={() => setPhotoSourceOpen(false)}
                onPick={handlePickAvatar}
                title={t('children.addPhoto')}
              />
            </div>

            <input
              type="text"
              value={childName}
              onChange={e => { setChildName(e.target.value); setError('') }}
              placeholder={t('children.childNamePlaceholder')}
              className="w-full bg-white rounded-2xl shadow-soft px-5 py-4 font-rubik text-brown-800 text-xl text-center outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />

            <div>
              <p className="text-xs text-brown-400 font-rubik text-center mb-2">{t('setup.newbornSection')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['תינוקי 🍼', 'כוכב שלי ⭐', 'מלכה שלי 👑', 'אהובי ❤️'].map(nick => (
                  <button
                    key={nick}
                    type="button"
                    onClick={() => { setChildName(nick); setError('') }}
                    className={`font-rubik text-sm px-4 py-2 rounded-full transition-all active:scale-95 ${
                      childName === nick ? 'bg-amber-500 text-white shadow-soft' : 'bg-white text-brown-600 shadow-card'
                    }`}
                  >
                    {nick}
                  </button>
                ))}
              </div>
              {childName && (
                <p className="text-xs text-amber-600 font-rubik text-center mt-2">{t('setup.newbornHint')}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-soft px-5 py-4 space-y-4">
              <p className="font-rubik text-xs text-brown-400 text-center">{t('setup.growthOptional')}</p>
              <div>
                <p className="text-sm font-medium text-brown-600 mb-2">{t('children.birthDate')}</p>
                <input
                  type="date"
                  value={childBirthDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setChildBirthDate(e.target.value)}
                  className="w-full bg-cream-100 rounded-xl px-4 py-3 font-rubik text-brown-800 outline-none"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-brown-600 mb-2">{t('children.gender')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ value: 'male', emoji: '👦', label: t('children.male') }, { value: 'female', emoji: '👧', label: t('children.female') }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChildGender(g => g === opt.value ? '' : opt.value)}
                      className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-rubik font-medium text-sm transition-all active:scale-95 ${childGender === opt.value ? 'text-white' : 'bg-cream-100 text-brown-600'}`}
                      style={childGender === opt.value ? { backgroundColor: '#5BAD6F' } : {}}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleChildSave} disabled={loading}>
              {loading ? t('app.loading') : t('setup.letsGo')}
            </Button>
            {!childName && (
              <p className="text-xs text-brown-300 font-rubik text-center -mt-2">{t('setup.noNameHint')}</p>
            )}
          </div>
        )}

        {/* ── DONE — show family code ──────────────────────────────────────────── */}
        {step === STEPS.DONE && (
          <div className="flex-1 flex flex-col justify-center text-center space-y-5">
            <div className="text-5xl">🎉</div>
            <h2 className="font-rubik font-bold text-2xl text-brown-800">{t('setup.familyCode')}</h2>
            {createdCode && (
              <>
                <div className="rounded-3xl shadow-card overflow-hidden">
                  <div className="bg-gradient-to-br from-amber-50 to-cream-100 py-8 px-4 text-center">
                    <p className="font-rubik font-bold text-5xl tracking-[0.4em] text-brown-800">{createdCode}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdCode)
                        setCodeCopied(true)
                        setTimeout(() => setCodeCopied(false), 2000)
                      }}
                      className="mt-4 text-sm font-rubik text-amber-700 bg-white px-5 py-2 rounded-full active:scale-95 transition-transform shadow-soft"
                    >
                      {codeCopied ? t('common.copied') : t('setup.copyCode')}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-brown-400 font-rubik">{t('setup.shareCode')}</p>
                <p className="text-xs text-brown-300 font-rubik -mt-2">{t('setup.codeHint')}</p>
              </>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={() => onFamilyJoined({ family: pendingFamily, member: pendingMember, childId: pendingChildId })}
            >
              {t('setup.goToDashboard')}
            </Button>
          </div>
        )}

      </div>
    </div>
  )
}
