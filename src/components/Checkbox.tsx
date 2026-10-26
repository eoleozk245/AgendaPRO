import { useId, type ComponentProps } from 'react'
import styles from './Checkbox.module.css'

type CheckboxProps = Omit<ComponentProps<'input'>, 'id' | 'type'> & {
  label: string
  hint?: string
}

export function Checkbox({ label, hint, className, ...rest }: CheckboxProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <input {...rest} id={id} type="checkbox" className={styles.input} aria-describedby={hintId} />
      <div>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
