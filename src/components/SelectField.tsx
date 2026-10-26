import { useId, type ComponentProps } from 'react'
import fieldStyles from './TextField.module.css'

type SelectFieldProps = Omit<ComponentProps<'select'>, 'id'> & {
  label: string
  hint?: string
}

export function SelectField({ label, hint, className, children, ...rest }: SelectFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={[fieldStyles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={fieldStyles.label}>
        {label}
      </label>
      <select {...rest} id={id} className={fieldStyles.input} aria-describedby={hintId}>
        {children}
      </select>
      {hint && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
