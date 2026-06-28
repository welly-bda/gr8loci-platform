'use server'
import { revalidatePath } from 'next/cache'
import { forPlatform } from '@/lib/db/platform'

export async function addDomainAction(formData: FormData): Promise<void> {
  const hostname = String(formData.get('hostname') ?? '').trim().toLowerCase()
  const blogId = String(formData.get('blogId') ?? '')
  if (!hostname || !blogId) throw new Error('hostname and blogId required')
  await forPlatform().domain.create({ data: { hostname, blogId, verifiedAt: new Date() } })
  revalidatePath('/admin/domains')
}
