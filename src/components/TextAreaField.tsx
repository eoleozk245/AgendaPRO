import { CircleAlert } from 'lucide-react'
import { useId, type ComponentProps } from 'react'
import styles from './TextField.module.css'

type TextAreaFieldProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  label: string
  hint?: string
  error?: string
}

export function TextAreaField({ label, hint, error, className, ...rest }: TextAreaFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        {...rest}
        id={id}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
