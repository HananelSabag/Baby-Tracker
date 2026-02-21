import { useState } from 'react'
import { t } from '../lib/strings'
import { MEMBER_NAMES } from '../lib/constants'
import { createFamily, joinFamily } from '../hooks/useFamily'
import { useApp } from '../hooks/useAppContext'
import { Button } from '../components/ui/Button'
import { cn } from '../lib/utils'

const STEPS = { CHOOSE: 'choose', NAME: 'name', CODE: 'code', DONE: 'done' }

export function SetupPage() {
  const { saveIdentity } = useApp()
  const [step, setStep] = useState(STEPS.CHOOSE)
  const [action, setAction] = useState(null) // 'create' | 'join'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [familyCode, setFamilyCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChoose(act) {
    setAction(act)
    setStep(STEPS.NAME)
  }

  function handleNameSelect(n) {
    setName(n)
    if (action === 'create') {
      handleCreate(n)
    } else {
      setStep(STEPS.CODE)
    }
  }

  async function handleCreate(memberName) {
    setLoading(true)
    setError('')
    try {
      const { family, member, deviceToken } = await createFamily(memberName)
      setFamilyCode(family.code)
      saveIdentity({ familyId: family.id, memberId: member.id, memberName, deviceToken })
      setStep(STEPS.DONE)
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (code.length !== 6) { setError(t('setup.codeError')); return }
    if (!name) { setError(t('setup.nameRequired')); return }
    setLoading(true)
    setError('')
    try {
      const { family, member, deviceToken } = await joinFamily(code, name)
      saveIdentity({ familyId: family.id, memberId: member.id, memberName: name, deviceToken })
    } catch {
      setError(t('setup.codeError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col items-center justify-center px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🍼</div>
          <h1 className="font-rubik font-bold text-4xl text-brown-800 mb-2">{t('setup.welcome')}</h1>
          <p className="font-rubik text-brown-400 text-base">{t('setup.subtitle')}</p>
        </div>

        {/* Step: Choose */}
        {step === STEPS.CHOOSE && (
          <div className="w-full space-y-3">
            <Button className="w-full" size="lg" onClick={() => handleChoose('create')}>
              {t('setup.createFamily')}
            </Button>
            <Button variant="secondary" className="w-full" size="lg" onClick={() => handleChoose('join')}>
              {t('setup.joinFamily')}
            </Button>
          </div>
        )}

        {/* Step: Choose name */}
        {step === STEPS.NAME && (
          <div className="w-full space-y-3">
            <p className="font-rubik font-semibold text-brown-700 text-center text-lg mb-4">{t('setup.chooseName')}</p>
            {loading ? (
              <div className="text-center text-brown-400 font-rubik">{t('app.loading')}</div>
            ) : (
              <>
                {[MEMBER_NAMES.DAD, MEMBER_NAMES.MOM].map(n => (
                  <button
                    key={n}
                    onClick={() => handleNameSelect(n)}
                    className="w-full py-5 rounded-3xl bg-white shadow-card font-rubik font-semibold text-brown-800 text-2xl active:scale-95 transition-transform"
                  >
                    {n === MEMBER_NAMES.DAD ? '👨 ' : '👩 '}{n}
                  </button>
                ))}
                {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}
              </>
            )}
          </div>
        )}

        {/* Step: Enter code (join) */}
        {step === STEPS.CODE && (
          <div className="w-full space-y-4">
            <p className="font-rubik text-brown-600 text-center">{t('setup.enterCode')}</p>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
              placeholder={t('setup.codePlaceholder')}
              className="w-full bg-white text-center text-3xl font-bold font-rubik tracking-[0.5em] rounded-2xl py-4 shadow-soft outline-none text-brown-800 uppercase"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm text-center font-rubik">{error}</p>}
            <Button className="w-full" size="lg" onClick={handleJoin} disabled={loading}>
              {loading ? t('app.loading') : t('setup.join')}
            </Button>
          </div>
        )}

        {/* Step: Done (show family code) */}
        {step === STEPS.DONE && (
          <div className="w-full text-center space-y-4">
            <p className="font-rubik text-brown-600">{t('setup.shareCode')}</p>
            <div className="bg-white rounded-3xl shadow-card py-8 px-4">
              <p className="font-rubik font-bold text-5xl tracking-[0.4em] text-brown-800">{familyCode}</p>
            </div>
            <p className="text-sm text-brown-400 font-rubik">{t('setup.shareCode')}</p>
            <Button
              className="w-full mt-4"
              size="lg"
              onClick={() => window.location.reload()}
            >
              {t('setup.continue')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
