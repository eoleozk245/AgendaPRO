import type { ComponentProps } from 'react'
import styles from './Card.module.css'

export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return <div {...rest} className={[styles.card, className].filter(Boolean).join(' ')} />
}
