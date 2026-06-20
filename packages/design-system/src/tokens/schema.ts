import { z } from 'zod'

export const TokensSchema = z.object({
  color: z.object({
    brand: z.object({
      primary: z.string(),
      primaryMuted: z.string(),
      accent: z.string(),
    }),
    neutral: z.object({
      '50': z.string(),
      '100': z.string(),
      '200': z.string(),
      '300': z.string(),
      '400': z.string(),
      '500': z.string(),
      '600': z.string(),
      '700': z.string(),
      '800': z.string(),
      '900': z.string(),
      '950': z.string(),
    }),
    semantic: z.object({
      success: z.string(),
      warning: z.string(),
      danger: z.string(),
      dangerHover: z.string(),
      info: z.string(),
    }),
    surface: z.object({
      page: z.string(),
      card: z.string(),
      overlay: z.string(),
    }),
    text: z.object({
      primary: z.string(),
      secondary: z.string(),
      muted: z.string(),
      inverse: z.string(),
      link: z.string(),
    }),
  }),
  typography: z.object({
    fontFamily: z.object({
      sans: z.string(),
      serif: z.string(),
      mono: z.string(),
    }),
    fontSize: z.object({
      xs: z.string(),
      sm: z.string(),
      base: z.string(),
      lg: z.string(),
      xl: z.string(),
      '2xl': z.string(),
      '3xl': z.string(),
      '4xl': z.string(),
      '5xl': z.string(),
    }),
    fontWeight: z.object({
      regular: z.number(),
      medium: z.number(),
      semibold: z.number(),
      bold: z.number(),
    }),
    lineHeight: z.object({
      tight: z.number(),
      snug: z.number(),
      normal: z.number(),
      relaxed: z.number(),
      loose: z.number(),
    }),
  }),
  spacing: z.object({
    '0': z.string(),
    '1': z.string(),
    '2': z.string(),
    '3': z.string(),
    '4': z.string(),
    '6': z.string(),
    '8': z.string(),
    '12': z.string(),
    '16': z.string(),
    '20': z.string(),
    '24': z.string(),
    '32': z.string(),
  }),
  radius: z.object({
    none: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    full: z.string(),
  }),
  shadow: z.object({
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
  }),
})

export type TokensInput = z.input<typeof TokensSchema>
