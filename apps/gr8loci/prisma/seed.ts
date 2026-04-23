import { PrismaClient, PostStatus } from '@prisma/client'

const prisma = new PrismaClient()

function paragraph(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] } as const
}

function heading(level: 1 | 2 | 3, text: string) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] } as const
}

async function main() {
  const adminEmail = process.env.ADMIN_STUB_EMAIL
  if (!adminEmail) throw new Error('ADMIN_STUB_EMAIL required for seeding')

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail },
    update: {},
  })

  const posts = [
    {
      slug: 'welcome-to-gr8loci',
      title: 'Welcome to GR8LOCI',
      excerpt: 'What the platform is about, in one short paragraph.',
      heroImageUrl: '/hero-post-1.svg',
      heroImageAlt: 'Welcome banner',
    },
    {
      slug: 'five-habits',
      title: 'Five Habits That Change Your Day',
      excerpt: 'A short list of practical daily habits with real evidence behind them.',
      heroImageUrl: '/hero-post-2.svg',
      heroImageAlt: 'Five habits illustration',
    },
    {
      slug: 'the-basics-of-sleep',
      title: 'The Basics of Sleep',
      excerpt: 'Why sleep matters, what wrecks it, and what helps.',
      heroImageUrl: '/hero-post-3.svg',
      heroImageAlt: 'Sleep article banner',
    },
  ]

  for (const p of posts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        heroImageUrl: p.heroImageUrl,
        heroImageAlt: p.heroImageAlt,
        status: PostStatus.published,
        publishedAt: new Date(),
        content: {
          type: 'doc',
          content: [
            heading(1, p.title),
            paragraph(p.excerpt ?? ''),
            heading(2, 'Section one'),
            paragraph('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis blandit.'),
            paragraph('Nulla facilisi. Sed euismod, risus a volutpat sagittis, lectus libero ultricies purus.'),
            heading(2, 'Section two'),
            paragraph('Integer vel augue a libero hendrerit placerat eu at augue.'),
          ],
        },
      },
    })
  }

  await prisma.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      title: 'About GR8LOCI',
      content: {
        type: 'doc',
        content: [
          heading(1, 'About GR8LOCI'),
          paragraph('GR8LOCI is a health & wellness publication. This about page exercises the typography and layout of the design system.'),
          heading(2, 'Our focus'),
          paragraph('Evidence-based habits, honest reviews, no fluff.'),
        ],
      },
    },
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
