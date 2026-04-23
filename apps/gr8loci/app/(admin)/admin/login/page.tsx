'use client'

import { useActionState } from 'react'
import { Button, Container, Heading, Input, Stack, Text } from '@platform/design-system'
import { loginAction } from '@/lib/auth-actions'

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, {})

  return (
    <main>
      <Container maxWidth="sm">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Admin sign in</Heading>
          <Text>F1 stub — not for production use.</Text>

          <form action={formAction}>
            <Stack gap={4}>
              <Input
                id="email"
                name="email"
                type="email"
                label="Email"
                required
                autoComplete="email"
              />
              <Input
                id="password"
                name="password"
                type="password"
                label="Password"
                required
                autoComplete="current-password"
              />
              {state.error && <Text style={{ color: 'var(--color-semantic-danger)' }}>{state.error}</Text>}
              <Button type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Container>
    </main>
  )
}
