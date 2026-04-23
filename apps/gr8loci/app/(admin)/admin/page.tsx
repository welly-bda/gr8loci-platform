import { Button, Container, Heading, Stack, Text } from '@platform/design-system'
import { auth, initAuthForRequest } from '@platform/auth'
import { logoutAction } from '@/lib/auth-actions'

export default async function AdminHomePage() {
  await initAuthForRequest()
  const session = await auth.getSession()

  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Admin</Heading>
          <Text>
            Signed in as <strong>{session?.email ?? 'unknown'}</strong>.
          </Text>
          <Text>
            The admin dashboard ships in F4. This page exists to prove the route guard and session flow work.
          </Text>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </Stack>
      </Container>
    </main>
  )
}
