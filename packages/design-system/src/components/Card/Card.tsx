import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Card.module.css'

export type CardVariant = 'elevated' | 'outlined' | 'flat'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  as?: 'div' | 'article' | 'section'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'elevated', as: Component = 'div', className, ...rest },
  ref,
) {
  return (
    <Component ref={ref} className={clsx(styles.card, styles[variant], className)} {...rest} />
  )
})
