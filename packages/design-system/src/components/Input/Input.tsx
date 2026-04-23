import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, className, ...rest },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={clsx(styles.input, error && styles.invalid, className)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
})
