import { forPlatform } from '@/lib/db/platform'
import { getActiveBlog, setActiveBlogAction } from '@/lib/active-blog'
import { Button } from '@/components/ui/button'

export async function TenantSwitcher() {
  const [blogs, active] = await Promise.all([
    forPlatform().blog.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getActiveBlog(),
  ])
  return (
    <form action={setActiveBlogAction} className="flex items-center gap-2">
      <select name="blogId" defaultValue={active.id} className="h-9 rounded-md border border-slate-300 px-2">
        {blogs.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Switch
      </Button>
    </form>
  )
}
