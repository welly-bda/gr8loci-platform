import { forPlatform } from '@/lib/db/platform'
import { Button } from '@/components/ui/button'
import { createBlogAction } from './actions'

export default async function BlogsPage() {
  const blogs = await forPlatform().blog.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, slug: true, name: true, status: true } })
  return (
    <div className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Blogs</h1>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {blogs.map((b) => (
          <li key={b.id} className="flex justify-between p-3"><span>{b.name}</span><span className="text-slate-500">{b.slug} · {b.status}</span></li>
        ))}
      </ul>
      <form action={createBlogAction} className="space-y-3 rounded-md border border-slate-200 p-4">
        <h2 className="font-medium">Create blog</h2>
        <input name="name" placeholder="Name" className="h-9 w-full rounded-md border border-slate-300 px-2" />
        <input name="slug" placeholder="slug (a-z0-9-)" className="h-9 w-full rounded-md border border-slate-300 px-2" />
        <Button type="submit">Create</Button>
      </form>
    </div>
  )
}
