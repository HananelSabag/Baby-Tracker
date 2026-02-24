import { useState, useRef } from 'react'
import { t } from '../lib/strings'
import { ROLES, PARENT_ROLES } from '../lib/constants'
import { createFamily, joinFamily } from '../hooks/useFamily'
import { addChild } from '../hooks/useChildren'
import { useApp } from '../hooks/useAppContext'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/ui/Toast'

const STEPS = { CHOOSE: 'choose', ROLE: 'role', FAMILY_NAME: 'family_name', CODE: 'code', CHILD: 'child', DONE: 'done' }

export function SetupPage() {
  const { user, onFamilyJoined } = useApp()
  const { toasts, showToast, dismissToast } = useToast()
  const [codeCopied, setCodeCopied] = useState(false)
  const [step, setStep] = useState(STEPS.CHOOSE)
  const [action, setAction] = useState(null)
  const [role, setRole] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  // Pending data — filled after CHILD step, used in DONE step button
  const [pendingFamily, setPendingFamily] = useState(null)
  const [pendingMember, setPendingMember] = useState(null)
  const [pendingChildId, setPendingChildId] = useState(null)
  const [childName, setChildName] = useState('')
  const [childAvatar, setChildAvatar] = useState(null)
  const [childAvatarFile, setChildAvatarFile] = useState(null)
  const [childBirthDate, setChildBirthDate] = useState('')
  const [childGender, setChildGender] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  const avatarUrl = user?.user_metadata?.avatar_url ?? null
  const googleName = user?.user_metadata?.full_name ?? ''

  function goBack() {
    setError('')
    if (step === STEPS.ROLE) setStep(STEPS.CHOOSE)
    else if (step === STEPS.FAMILY_NAME) setStep(STEPS.ROLE)
    else if (step === STEPS.CODE) setStep(STEPS.ROLE)
    else if (step === STEPS.CHILD) setStep(STEPS.FAMILY_NAME)
  }

  function handleChoose(act) {
    setAction(act)
    setStep(STEPS.ROLE)
  }

  function handleRoleContinue() {
    if (!role) { setError(t('setup.roleRequired')); return }
    setError('')
    setStep(action === 'create' ? STEPS.FAMILY_NAME : STEPS.CODE)
  }

  // Validate family name and advance — family is NOT created in DB yet
  function handleFamilyNameNext() {
    if (!familyName.trim()) { setError(t('setup.nameRequired')); return }
    setError('')
    setStep(STEPS.CHILD)
  }

  async function handleJoin() {
    if (code.length !== 6) { setError(t('setup.codeError')); return }
    setLoading(true)
    setError('')
    try {
      const { family, member } = await joinFamily({ code, role, customRole, authUserId: user.id, avatarUrl })
      // Auto-select first child if family already has one
      const { data: existingChildren } = await supabase
        .from('children').select('id').eq('family_id', family.id)
        .order('created_at', { ascending: true }).limit(1)
      const childId = existingChildren?.[0]?.id ?? null
      onFamilyJoined({ family, member, childId })
      // isSetupDone → true → App navigates to HomePage automatically
    } catch (err) {
      if (err.message === 'family_full') setError(t('errors.familyFull'))
      else if (err.message === 'role_taken') setError(t('errors.roleTaken'))
      else setError(t('setup.codeError'))
    } finally {
      setLoading(false)
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setChildAvatarFile(file)
    const reader = new FileReader()
    reader.onload = ev => setChildAvatar(ev.target.result)
    reader.readAsDataURL(file)
  }

  // Create family + member + child all at once — deferred from FAMILY_NAME step
  async function handleChildSave() {
    if (!childName.trim()) { setError(t('children.nameRequired')); return }
    setLoading(true)
    setError('')
    try {
      // Step 1: upload child avatar
      let uploadedUrl = null
      if (childAvatarFile) {
        const ext = childAvatarFile.name.split('.').pop()
        const path = `children/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, childAvatarFile)
        if (uploadErr) {
          console.error('[Setup] avatar upload error:', uploadErr)
          setError(`שגיאת העלאת תמונה: ${uploadErr.message}`)
          setLoading(false)
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        uploadedUrl = urlData.publicUrl
      }

      // Step 2: create family + member
      let family, member
      try {
        ;({ family, member } = await createFamily({
          familyName: familyName.trim(),
          role,
          customRole,
          authUserId: user.id,
          avatarUrl,
        }))
      } catch (e) {
        console.error('[Setup] createFamily error:', e)
        setError(`שגיאת יצירת משפחה: ${e?.message ?? JSON.stringify(e)}`)
        setLoading(false)
        return
      }

      // Step 3: add child
      let child
      try {
        child = await addChild({ familyId: family.id, name: childName.trim(), avatarUrl: uploadedUrl, birthDate: childBirthDate || null, gender: childGender || null })
      } catch (e) {
        console.error('[Setup] addChild error:', e)
        setError(`שגיאת הוספת ילד: ${e?.message ?? JSON.stringify(e)}`)
        setLoading(false)
        return
      }

      // Store for DONE step — don't call onFamilyJoined yet so DONE step stays visible
      setCreatedCode(family.code)
      setPendingFamily(family)
      setPendingMember(member)
      setPendingChildId(child.id)
      showToast({ message: `${childName.trim()} נוסף בהצלחה!`, emoji: '👶' })
      setStep(STEPS.DONE)
    } catch (e) {
      console.error('[Setup] unexpected error:', e)
      setError(`שגיאה לא צפויה: ${e?.message ?? JSON.stringify(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const showBack = step !== STEPS.CHOOSE && step !== STEPS.DONE

  // Step progress dots: which step index + total for current path
  function getStepProgress() {
    if (step === STEPS.CHOOSE || step === STEPS.DONE) return null
    const steps = action === 'create'
      ? [STEPS.ROLE, STEPS.FAMILY_NAME, STEPS.CHILD]
      : [STEPS.ROLE, STEPS.CODE]
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

        {/* User greeting — always shown when we know the name */}
        {googleName && (
          <div className="flex items-center gap-3 mb-6">
            {avatarUrl
              ? <img src={avatarUrl} alt={googleName} className="w-10 h-10 rounded-full object-cover" />
              : <div className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center text-xl">👤</div>
            }
            <p className="font-rubik text-brown-600 text-sm">שלום, {googleName} 👋</p>
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

        {/* Step: Choose create or join */}
        {step === STEPS.CHOOSE && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🍼</div>
              <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('setup.createOrJoin')}</h1>
              <p className="font-rubik text-brown-400 text-sm mt-1">ברוך הבא! איך נתחיל?</p>
            </div>

            {/* Create family card */}
            <button
              onClick={() => handleChoose('create')}
              className="w-full rounded-3xl bg-white shadow-card overflow-hidden active:scale-[0.98] transition-transform text-right"
            >
              <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl flex-shrink-0">✨</div>
                <div className="flex-1 min-w-0">
                  <p className="font-rubik font-bold text-brown-800 text-lg">{t('setup.createFamily')}</p>
                  <p className="font-rubik text-brown-400 text-sm mt-0.5">התחל מסע חדש עם המשפחה שלך</p>
                </div>
                <span className="text-brown-300 text-2xl flex-shrink-0">›</span>
              </div>
            </button>

            {/* Join family card */}
            <button
              onClick={() => handleChoose('join')}
              className="w-full rounded-3xl bg-white shadow-soft overflow-hidden active:scale-[0.98] transition-transform text-right"
            >
              <div className="h-1.5 bg-gradient-to-r from-brown-400 to-brown-600" />
              <div className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cream-200 flex items-center justify-center text-3xl flex-shrink-0">🔗</div>
                <div className="flex-1 min-w-0">
                  <p className="font-rubik font-bold text-brown-800 text-lg">{t('setup.joinFamily')}</p>
                  <p className="font-rubik text-brown-400 text-sm mt-0.5">הצטרף לתא משפחתי קיים עם קוד</p>
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

        {/* Step: Choose role */}
        {step === STEPS.ROLE && (
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <h2 className="font-rubik font-bold text-xl text-brown-800 text-center mb-2">{t('setup.chooseRole')}</h2>
            {/* When creating: only parent roles (needed for child management RLS) */}
            {(action === 'create' ? ROLES.filter(r => PARENT_ROLES.includes(r.value)) : ROLES).map(r => (
              <button
                key={r.value}
                onClick={() => { setRole(r.value); setError('') }}
                className={cn(
                  'w-full flex items-center gap-4 py-4 px-5 rounded-2xl font-rubik font-medium text-lg transition-all active:scale-95',
                  role === r.value ? 'bg-amber-500 text-white shadow-soft' : 'bg-white shadow-card text-brown-800'
                )}
              >
                <span className="text-2xl">{r.emoji}</span>
                <span className="flex-1 text-right">{r.label}</span>
                {role === r.value && <span className="text-white font-bold text-xl">✓</span>}
              </button>
            ))}
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
            <Button className="w-full mt-2" size="lg" onClick={handleRoleContinue}>
              {t('setup.continue')}
            </Button>
          </div>
        )}

        {/* Step: Enter family name (create) */}
        {step === STEPS.FAMILY_NAME && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <h2 className="font-rubik font-bold text-xl text-brown-800 text-center mb-2">{t('setup.familyName')}</h2>
            <input
              type="text"
              value={familyName}
              onChange={e => { setFamilyName(e.target.value); setError('') }}
              placeholder={t('setup.familyNamePlaceholder')}
              className="w-full bg-white rounded-2xl shadow-soft px-5 py-4 font-rubik text-brown-800 text-lg outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleFamilyNameNext}>
              {t('setup.continue')}
            </Button>
          </div>
        )}

        {/* Step: Enter code (join) */}
        {step === STEPS.CODE && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <h2 className="font-rubik font-bold text-xl text-brown-800 text-center mb-2">{t('setup.enterCode')}</h2>
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
            <Button className="w-full" size="lg" onClick={handleJoin} disabled={loading}>
              {loading ? t('app.loading') : t('setup.join')}
            </Button>
          </div>
        )}

        {/* Step: Add first child */}
        {step === STEPS.CHILD && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">👶</div>
              <h2 className="font-rubik font-bold text-xl text-brown-800">{t('setup.addFirstChild')}</h2>
              <p className="font-rubik text-brown-400 text-sm mt-1">{t('setup.addChildSubtitle')}</p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-full bg-cream-200 shadow-soft flex items-center justify-center overflow-hidden active:scale-95 transition-transform border-4 border-white"
              >
                {childAvatar
                  ? <img src={childAvatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-5xl">👶</span>
                }
              </button>
              <button onClick={() => fileRef.current?.click()} className="text-xs font-rubik text-brown-500 bg-cream-200 px-4 py-2 rounded-full">
                {t('children.addPhoto')}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            <input
              type="text"
              value={childName}
              onChange={e => { setChildName(e.target.value); setError('') }}
              placeholder={t('children.childNamePlaceholder')}
              className="w-full bg-white rounded-2xl shadow-soft px-5 py-4 font-rubik text-brown-800 text-xl text-center outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />

            {/* Birth date + gender — optional, needed for growth chart */}
            <div className="bg-white rounded-2xl shadow-soft px-5 py-4 space-y-4">
              <p className="font-rubik text-xs text-brown-400 text-center">
                לא חובה — נדרש לגרף גדילה לפי עקומות WHO ⚖️
              </p>
              <div>
                <p className="text-sm font-medium text-brown-600 mb-2">תאריך לידה</p>
                <input
                  type="date"
                  value={childBirthDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setChildBirthDate(e.target.value)}
                  className="w-full bg-cream-100 rounded-xl px-4 py-3 font-rubik text-brown-800 outline-none"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-brown-600 mb-2">מין</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ value: 'male', emoji: '👦', label: 'ילד' }, { value: 'female', emoji: '👧', label: 'ילדה' }].map(opt => (
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
              {loading ? t('app.loading') : t('common.save')}
            </Button>
          </div>
        )}

        {/* Step: Done — show family code, then navigate to app */}
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
                <p className="text-xs text-brown-300 font-rubik -mt-2">ניתן למצוא את הקוד תמיד בפרופיל שלך</p>
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
