import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Quando o estado vazio é o conteúdo principal da página, o título vira o h1. */
  pageTitle?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, pageTitle }: EmptyStateProps) {
  const Title = pageTitle ? 'h1' : 'p'
  return (
    <div className={styles.empty}>
      <Icon size={32} aria-hidden="true" />
      <Title className={styles.title}>{title}</Title>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  )
}
