import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'

type BadgeProps = {
  tone?: BadgeTone
  /** Ícone que reforça o significado, para o estado não depender só da cor. */
  icon?: ReactNode
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  )
}
