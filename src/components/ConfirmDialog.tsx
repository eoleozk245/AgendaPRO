import { useState, type ReactNode } from 'react'
import { Alert } from './Alert.tsx'
import { Button } from './Button.tsx'
import styles from './ConfirmDialog.module.css'
import { Modal } from './Modal.tsx'

type ConfirmDialogProps = {
  title: string
  children: ReactNode
  confirmLabel: string
  /** Ação confirmada. Se lançar erro, a mensagem aparece no diálogo. */
  onConfirm: () => Promise<void>
  onClose: () => void
  errorMessage: (error: unknown) => string
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  errorMessage,
}: ConfirmDialogProps) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string>()

  async function confirm() {
    setRunning(true)
    setError(undefined)
    try {
      await onConfirm()
    } catch (caught) {
      setError(errorMessage(caught))
      setRunning(false)
    }
  }

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" loading={running} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {error && (
        <div className={styles.error}>
          <Alert tone="error" title={error} />
        </div>
      )}
    </Modal>
  )
}
