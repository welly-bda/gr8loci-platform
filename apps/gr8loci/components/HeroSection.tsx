import { Container, Heading, Stack, Text } from '@platform/design-system'
import styles from './HeroSection.module.css'

export interface HeroSectionProps {
  title: string
  tagline: string
  imageUrl: string
  imageAlt: string
}

export function HeroSection({ title, tagline, imageUrl, imageAlt }: HeroSectionProps) {
  return (
    <section className={styles.hero}>
      <img className={styles.image} src={imageUrl} alt={imageAlt} />
      <Container>
        <Stack gap={4} className={styles.content}>
          <Heading level={1}>{title}</Heading>
          <Text size="lg">{tagline}</Text>
        </Stack>
      </Container>
    </section>
  )
}
