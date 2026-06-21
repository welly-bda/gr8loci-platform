import { Container, Heading, Stack, Text } from '@platform/design-system'

export default function NotFound() {
  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={4} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Not found</Heading>
          <Text>This address isn&apos;t available.</Text>
        </Stack>
      </Container>
    </main>
  )
}
