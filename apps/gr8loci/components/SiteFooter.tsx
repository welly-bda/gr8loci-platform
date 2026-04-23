import { Container, Text } from '@platform/design-system'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Container>
        <Text size="sm">© {new Date().getFullYear()} GR8LOCI. All rights reserved.</Text>
      </Container>
    </footer>
  )
}
