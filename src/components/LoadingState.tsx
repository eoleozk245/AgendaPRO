import { LoaderCircle } from 'lucide-react'
import styles from './LoadingState.module.css'

export function LoadingState({ label }: { label: string }) {
  return (
    <div className={styles.loading} role="status">
      <LoaderCircle className={styles.spinner} size={28} aria-hidden="true" />
      <p>{label}…</p>
    </div>
  )
}
