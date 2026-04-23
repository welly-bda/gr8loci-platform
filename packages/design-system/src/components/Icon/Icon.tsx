import type { ComponentType, SVGProps } from 'react'

export type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 28,
  xl: 36,
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  as: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  size?: IconSize
}

export function Icon({ as: Component, size = 'md', ...rest }: IconProps) {
  const px = SIZE_PX[size]
  const hasLabel = typeof rest['aria-label'] === 'string' && rest['aria-label'].length > 0
  return (
    <Component
      width={px}
      height={px}
      aria-hidden={hasLabel ? undefined : true}
      {...rest}
    />
  )
}
