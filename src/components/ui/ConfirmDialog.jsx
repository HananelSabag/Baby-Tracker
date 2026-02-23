import { t } from '../../lib/strings'
import { Button } from './Button'

export function ConfirmDialog({ isOpen, message, onConfirm, onCancel, confirmLabel, confirmVariant = 'danger' }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-brown-800/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm">
        <p className="font-rubik text-brown-800 text-center text-base mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant={confirmVariant} className="flex-1" onClick={onConfirm}>
            {confirmLabel ?? t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
