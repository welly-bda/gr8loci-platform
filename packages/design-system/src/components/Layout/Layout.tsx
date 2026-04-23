import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Layout.module.css'

type GapToken = 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16
type AlignItems = 'start' | 'center' | 'end' | 'stretch'
type JustifyContent = 'start' | 'center' | 'end' | 'between'

const alignMap: Record<AlignItems, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
}

const justifyMap: Record<JustifyContent, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
}

interface StackOrRowProps extends HTMLAttributes<HTMLDivElement> {
  gap?: GapToken
  align?: AlignItems
  justify?: JustifyContent
}

export type StackProps = StackOrRowProps
export type RowProps = StackOrRowProps

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { gap = 4, align = 'stretch', justify = 'start', className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(styles.stack, className)}
      style={{
        gap: `var(--space-${gap})`,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        ...style,
      }}
      {...rest}
    />
  )
})

export const Row = forwardRef<HTMLDivElement, RowProps>(function Row(
  { gap = 4, align = 'center', justify = 'start', className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(styles.row, className)}
      style={{
        gap: `var(--space-${gap})`,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        ...style,
      }}
      {...rest}
    />
  )
})

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { maxWidth = 'lg', className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={clsx(styles.container, styles[`maxw-${maxWidth}`], className)} {...rest} />
  )
})
