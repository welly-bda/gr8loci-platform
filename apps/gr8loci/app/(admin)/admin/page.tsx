import { Button, Container, Heading, Stack, Text } from '@platform/design-system'
import { auth, initAuthForRequest } from '@platform/auth'
import { logoutAction } from '@/lib/auth-actions'
import { getActiveBlog } from '@/lib/active-blog'
import { TenantSwitcher } from './_components/TenantSwitcher'

export default async function AdminHomePage() {
  await initAuthForRequest()
  const session = await auth.getSession()
  const activeBlog = await getActiveBlog()

  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Admin</Heading>
          <Text>
            Signed in as <strong>{session?.email ?? 'unknown'}</strong>.
          </Text>
          <Text>
            Active tenant: <strong>{activeBlog.name}</strong> ({activeBlog.slug})
          </Text>
          <TenantSwitcher />
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
