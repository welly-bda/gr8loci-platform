import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, HTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Typography.module.css'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level = 1, className, ...rest },
  ref,
) {
  const Tag = `h${level}` as const
  return <Tag ref={ref} className={clsx(styles.heading, styles[`h${level}`], className)} {...rest} />
})

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'div'
  size?: 'sm' | 'base' | 'lg'
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as: Component = 'p', size = 'base', className, ...rest },
  ref,
) {
  return <Component ref={ref as never} className={clsx(styles.text, styles[`text-${size}`], className)} {...rest} />
})

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement>

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { className, ...rest },
  ref,
) {
  return <a ref={ref} className={clsx(styles.link, className)} {...rest} />
})
