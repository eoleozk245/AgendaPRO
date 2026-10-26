import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './Alert.module.css'

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const icons: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
}

type AlertProps = {
  tone?: AlertTone
  title: string
  children?: ReactNode
}

export function Alert({ tone = 'info', title, children }: AlertProps) {
  const Icon = icons[tone]
  // Avisos e erros são anunciados na hora pelo leitor de tela; os demais, com calma.
  const role = tone === 'error' || tone === 'warning' ? 'alert' : 'status'

  return (
    <div role={role} className={`${styles.alert} ${styles[tone]}`}>
      <Icon className={styles.icon} size={20} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </div>
  )
}
