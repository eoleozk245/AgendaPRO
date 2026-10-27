import { CircleAlert } from 'lucide-react'
import { useId, type ComponentProps } from 'react'
import styles from './TextField.module.css'

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string
  /** Texto de ajuda abaixo do campo. */
  hint?: string
  /** Mensagem de erro. Quando existe, o campo fica marcado como inválido. */
  error?: string
}

export function TextField({ label, hint, error, required, className, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <input
        {...rest}
        id={id}
        required={required}
        className={styles.input}
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
