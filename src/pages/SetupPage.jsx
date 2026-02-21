import { useState, useRef } from 'react'
import { t } from '../lib/strings'
import { ROLES } from '../lib/constants'
import { createFamily, joinFamily } from '../hooks/useFamily'
import { addChild } from '../hooks/useChildren'
import { useApp } from '../hooks/useAppContext'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

const STEPS = { CHOOSE: 'choose', ROLE: 'role', FAMILY_NAME: 'family_name', CODE: 'code', CHILD: 'child', DONE: 'done' }

export function SetupPage() {
  const { user, onFamilyJoined, setActiveChildId } = useApp()
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
    } catch {
      setError(t('setup.codeError'))
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
      let uploadedUrl = null
      if (childAvatarFile) {
        const ext = childAvatarFile.name.split('.').pop()
        const path = `children/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, childAvatarFile)
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          uploadedUrl = urlData.publicUrl
        }
      }

      const { family, member } = await createFamily({
        familyName: familyName.trim(),
        role,
        customRole,
        authUserId: user.id,
        avatarUrl,
      })
      const child = await addChild({ familyId: family.id, name: childName.trim(), avatarUrl: uploadedUrl })

      // Store for DONE step — don't call onFamilyJoined yet so DONE step stays visible
      setCreatedCode(family.code)
      setPendingFamily(family)
      setPendingMember(member)
      setPendingChildId(child.id)
      setStep(STEPS.DONE)
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  const showBack = step !== STEPS.CHOOSE && step !== STEPS.DONE

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
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
        {avatarUrl && (
          <div className="flex items-center gap-3 mb-8">
            <img src={avatarUrl} alt={googleName} className="w-10 h-10 rounded-full object-cover" />
            <p className="font-rubik text-brown-600 text-sm">שלום, {googleName} 👋</p>
          </div>
        )}

        {/* Step: Choose create or join */}
        {step === STEPS.CHOOSE && (
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🍼</div>
              <h1 className="font-rubik font-bold text-2xl text-brown-800">{t('setup.createOrJoin')}</h1>
            </div>
            <button onClick={() => handleChoose('create')} className="w-full py-5 rounded-3xl bg-white shadow-card font-rubik font-semibold text-brown-800 text-lg active:scale-95 transition-transform">
              ✨ {t('setup.createFamily')}
            </button>
            <button onClick={() => handleChoose('join')} className="w-full py-5 rounded-3xl bg-cream-200 font-rubik font-medium text-brown-700 text-lg active:scale-95 transition-transform">
              🔗 {t('setup.joinFamily')}
            </button>
          </div>
        )}

        {/* Step: Choose role */}
        {step === STEPS.ROLE && (
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <h2 className="font-rubik font-bold text-xl text-brown-800 text-center mb-2">{t('setup.chooseRole')}</h2>
            {ROLES.map(r => (
              <button
                key={r.value}
                onClick={() => { setRole(r.value); setError('') }}
                className={cn(
                  'w-full flex items-center gap-4 py-4 px-5 rounded-2xl font-rubik font-medium text-lg transition-all active:scale-95',
                  role === r.value ? 'bg-brown-600 text-white shadow-soft' : 'bg-white shadow-card text-brown-800'
                )}
              >
                <span className="text-2xl">{r.emoji}</span>
                {r.label}
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
              className="w-full bg-white rounded-2xl shadow-soft px-5 py-4 font-rubik text-brown-800 text-lg outline-none"
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
              className="w-full bg-white text-center text-3xl font-bold font-rubik tracking-[0.5em] rounded-2xl py-5 shadow-soft outline-none text-brown-800 uppercase"
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
              className="w-full bg-white rounded-2xl shadow-soft px-5 py-4 font-rubik text-brown-800 text-xl text-center outline-none"
              autoFocus
            />

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
                <div className="bg-white rounded-3xl shadow-card py-8 px-4">
                  <p className="font-rubik font-bold text-5xl tracking-[0.4em] text-brown-800">{createdCode}</p>
                </div>
                <p className="text-sm text-brown-400 font-rubik">{t('setup.shareCode')}</p>
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
