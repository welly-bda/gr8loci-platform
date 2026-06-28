import { forPlatform } from '@/lib/db/platform'
import { Button } from '@/components/ui/button'
import { addDomainAction } from './actions'

export default async function DomainsPage() {
  const db = forPlatform()
  const [domains, blogs] = await Promise.all([
    db.domain.findMany({ orderBy: { hostname: 'asc' }, select: { id: true, hostname: true, isPrimary: true, blog: { select: { name: true } } } }),
    db.blog.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  return (
    <div className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Domains</h1>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {domains.map((d) => (
          <li key={d.id} className="flex justify-between p-3">
            <span>{d.hostname}{d.isPrimary ? ' (primary)' : ''}</span>
            <span className="text-slate-500">{d.blog.name}</span>
          </li>
        ))}
      </ul>
      <form action={addDomainAction} className="space-y-3 rounded-md border border-slate-200 p-4">
        <h2 className="font-medium">Add domain</h2>
        <input name="hostname" placeholder="hostname (e.g. blog.example.com)" className="h-9 w-full rounded-md border border-slate-300 px-2" />
        <select name="blogId" className="h-9 w-full rounded-md border border-slate-300 px-2">
          {blogs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button type="submit">Add</Button>
      </form>
    </div>
  )
}
