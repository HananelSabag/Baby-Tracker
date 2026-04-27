import { useState } from 'react'
import { t } from '../../lib/strings'
import { cn } from '../../lib/utils'
import { pickAndCompressImage } from '../../lib/imageUpload'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { PhotoSourceSheet } from './PhotoSourceSheet'

export function ChildFormSheet({ isOpen, onClose, title, initialName = '', initialAvatar = null, initialBirthDate = '', initialGender = '', onSave }) {
  const [name, setName] = useState(initialName)
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar)
  const [photo, setPhoto] = useState(null)
  const [birthDate, setBirthDate] = useState(initialBirthDate)
  const [gender, setGender] = useState(initialGender)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false)

  async function handlePickPhoto(mode) {
    setPhotoBusy(true)
    try {
      const picked = await pickAndCompressImage({ mode })
      if (!picked) return
      setPhoto(picked)
      setAvatarPreview(URL.createObjectURL(picked.blob))
    } catch (err) {
      setError(err?.message ?? t('errors.saveFailed'))
    } finally {
      setPhotoBusy(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('children.nameRequired')); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), photo, birthDate: birthDate || null, gender: gender || null })
    } catch {
      setError(t('errors.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setPhotoSourceOpen(true)}
            disabled={photoBusy}
            className="w-20 h-20 rounded-full overflow-hidden bg-cream-200 flex items-center justify-center active:scale-95 transition-transform border-4 border-white shadow-soft disabled:opacity-60"
          >
            {photoBusy
              ? <span className="text-2xl">⏳</span>
              : avatarPreview
                ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-4xl">👶</span>
            }
          </button>
          <button onClick={() => setPhotoSourceOpen(true)} disabled={photoBusy} className="text-xs font-rubik text-brown-500 bg-cream-200 px-3 py-1.5 rounded-full disabled:opacity-60">
            {t('children.addPhoto')}
          </button>
          <PhotoSourceSheet
            isOpen={photoSourceOpen}
            onClose={() => setPhotoSourceOpen(false)}
            onPick={handlePickPhoto}
            title={t('children.addPhoto')}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-brown-600 mb-2">{t('children.childName')}</p>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            placeholder={t('children.childNamePlaceholder')}
            className="w-full bg-cream-200 rounded-2xl px-4 py-3 font-rubik text-brown-800 text-base outline-none"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1 font-rubik">{error}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-brown-600 mb-2">{t('children.birthDate')}</p>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setBirthDate(e.target.value)}
              className="w-full bg-cream-200 rounded-2xl px-3 py-3 font-rubik text-brown-800 outline-none text-sm"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-brown-600 mb-2">{t('children.gender')}</p>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: 'male', emoji: '👦', label: t('children.male') }, { value: 'female', emoji: '👧', label: t('children.female') }].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(g => g === opt.value ? '' : opt.value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-rubik font-medium text-sm transition-all active:scale-95',
                    gender === opt.value ? 'text-white' : 'bg-cream-200 text-brown-600'
                  )}
                  style={gender === opt.value ? { backgroundColor: '#5BAD6F' } : {}}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t('app.loading') : t('common.save')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
