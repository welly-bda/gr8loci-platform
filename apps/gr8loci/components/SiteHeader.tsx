import Link from 'next/link'
import { Container, Row } from '@platform/design-system'
import styles from './SiteHeader.module.css'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Container>
        <Row align="center" justify="between" gap={6}>
          <Link href="/" className={styles.brand}>
            GR8LOCI
          </Link>
          <nav>
            <Row gap={6} align="center">
              <Link href="/">Home</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/about">About</Link>
            </Row>
          </nav>
        </Row>
      </Container>
    </header>
  )
}
