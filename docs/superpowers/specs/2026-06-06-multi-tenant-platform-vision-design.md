# Multi-Tenant Content Platform — North-Star Vision & Roadmap Re-Baseline

**Date:** 2026-06-06
**Status:** Vision / program decomposition (not an implementation spec)
**Supersedes:** the F2→F3→F4→O2 roadmap in `CLAUDE.md` and `docs/superpowers/handoff/README.md`

> This document re-baselines the project roadmap around a multi-tenant content
> platform. It is deliberately a **north-star**: it fixes the architecture and
> decomposes the work into increments. Each increment (P1…P6) gets its own
> detailed spec + implementation plan before any code is written for it.

---

## 1. What we're building

A **multi-tenant content/blog platform**: one Next.js application serving many
independent blogs. A small set of **invited operators** each run their own
blog(s); the repo owner is platform super-admin. Each blog is reachable at a
free platform subdomain and, optionally, its own custom domain. Operators
compose pages from reusable content blocks, theme their blog at runtime, collect
email subscribers (double opt-in) and send newsletters, show notification
banners, and serve media from a CDN. Everything is Postgres-backed, accessible,
and uses no local file storage.

The feature set is **based on the proven legacy site** at
`~/Developer/ClaudeDev-local/gr8loci-online/` (Node/Express), re-cast for
multi-tenancy and the new stack.

## 2. Why the roadmap changed

The original roadmap assumed: single brand now, **app-per-brand** multi-brand
later (O2), **CSS Modules only**, **stub auth until F4 (Clerk)**, and media
in F4. The product intent is now broader and reshapes those assumptions:

| Assumption (old) | Decision (new) |
| --- | --- |
| App-per-brand multi-brand (O2) | **Single app, row-level multi-tenancy** resolved by hostname |
| CSS Modules only; no Tailwind | **shadcn/Tailwind adopted** for the block builder + admin UI |
| Stub auth until F4 | **Clerk pulled forward** — invited operators need real multi-user auth + roles now |
| Media in F4 | **Dedicated media increment (P3)**, DO Spaces only, real `Media` model |
| Honeypot for form spam | **Cloudflare Turnstile** (widget + server verify); honeypot kept as a cheap first layer |

These changes are recorded here and must be reflected in `CLAUDE.md` and the
handoff README as part of P1.

## 3. Confirmed decisions

1. **Tenancy model — shared DB, row-level (approach A).** One Postgres database,
   one schema. Every tenant-owned row carries a `blogId`. Isolation is enforced
   in the application layer via a **mandatory tenant-scoped data-access layer**
   (a Prisma wrapper that injects `blogId` on every query). Rule extends the
   existing "no naked SQL": **no unscoped Prisma in application code.** Keeps the
   door open to extract a hot tenant to its own DB later without forcing that
   complexity now. (Schema-per-tenant and DB-per-tenant rejected as overkill for
   a curated operator set.)
2. **Audience — invited operators.** No public signup, no billing. Per-tenant
   roles; super-admin onboards operators and assigns blogs.
3. **URLs — subdomain + custom domain.** Every blog gets `slug.gr8loci.online`
   free; each may attach a custom domain. Tenant resolved from the request
   hostname in middleware. Custom domains require automated provisioning on
   Vercel.
4. **UI stack — shadcn/Tailwind.** Reverses the CSS-Modules-only rule. The
   existing 6 CSS-module primitives are superseded by shadcn components over the
   course of P1–P2 (not a big-bang rewrite; replace as we build).
5. **Auth — Clerk.** Clerk organizations map to tenants; roles per org
   (super-admin / operator-admin / editor). Replaces the JWT stub.
6. **Theming — F2 runtime theme engine becomes per-tenant.** The `BrandTheme`
   model and `ThemeStyle` RSC already built in F2 generalize to per-tenant token
   sets keyed by `blogId`.
7. **Email — capture + send.** Double-opt-in capture per blog, plus newsletter
   sending (new-post notifications and operator-composed newsletters) via a
   Resend-class provider. Unsubscribe handling and lead magnets included.
8. **Templates — block/page builder.** Operators compose pages from reusable
   content blocks (hero, post grid, CTA, rich text, image, …) built on shadcn.
9. **Media — DO Spaces only.** Direct-to-Spaces uploads, CDN delivery, a real
   `Media` model. **No local disk storage**, ever. Drops the legacy local
   fallback. Accessible alt-text enforced.
10. **Anti-bot — Turnstile at form level.** Embeddable Turnstile widget on the
    public email-signup and contact forms with **server-side `siteverify`**.
    Honeypot retained as a free first layer. **Full-site Cloudflare proxy is NOT
    adopted** (see §8).

## 4. Architecture overview

### Request flow

```
visitor → Vercel edge → middleware (hostname → blog lookup → tenant context)
        → RSC / route handler → tenant-scoped data-access layer → Postgres
```

- **Hostname resolution (middleware).** Parse the request host. If it matches
  `*.gr8loci.online`, the subdomain label is the blog slug. Otherwise look it up
  in a `Domain` table mapping custom hostname → `blogId`. The resolved `blogId`
  (and resolved blog config) is attached to the request context for downstream
  use. Unknown hosts → platform landing / 404.
- **Tenant-scoped data access.** All content reads/writes go through a helper
  that requires a `blogId` and injects it into every query. App code never calls
  `prisma.blogPost.*` directly. Tests assert cross-tenant queries cannot leak.
- **Auth (Clerk).** Clerk org = tenant. A request's Clerk session determines
  which blogs the user may administer; admin routes are scoped to the active
  org's `blogId`. Super-admin can act across tenants.
- **Theming.** Per-tenant tokens loaded by `blogId` and emitted as CSS custom
  properties via the F2 `ThemeStyle` RSC in the root layout.

### Core data model (additive over current schema)

New/changed models (details finalized per increment):

- `Blog` (the tenant): `id`, `slug` (subdomain), `name`, status, settings,
  theme reference.
- `Membership`: links a Clerk user to a `Blog` with a `role`.
- `Domain`: custom hostname → `blogId`, verification + provisioning status.
- Existing `BlogPost`, `Page`, `BrandTheme` gain a `blogId` foreign key.
- Later increments add `Media`, `Subscriber`, `Newsletter`/`Campaign`,
  `Banner` (from legacy `Announcement`), `LeadMagnet`.

## 5. Legacy reuse mapping

| Legacy (working) feature | New platform |
| --- | --- |
| `BlogPost` (HTML via Quill) | Posts re-cast to **block/JSON content** (reuse F1 `RichContent`), tenant-scoped |
| `BlogCategory`, `BlogTag`, related-posts | Carried forward, tenant-scoped |
| `HomePageContent` / `PageHeader` | **Block-composed pages** in the builder |
| `Announcement` (banner, date-range, priority) | **Notification banner** (P5), per-tenant + platform-wide |
| `EmailSubscriber`, `LeadMagnet`, `EmailCampaign`, `EmailTemplate` | **Email capture + newsletters** (P6); Nodemailer → Resend |
| Image upload to DO Spaces (S3 SDK, env-prefixed paths) | **Media subsystem** (P3), Spaces-only, real `Media` model |
| `AdminUser` roles, sessions, activity log | **Clerk** orgs + roles; activity-log concept retained |
| Sitemap, robots, contact form (honeypot), social-share | Carried forward, tenant-scoped; honeypot + Turnstile |

**Dropped / deferred:** raw-HTML Quill authoring (replaced by blocks);
local-disk image fallback (Spaces-only); comments (legacy model unused);
search; RSS — treated as explicit later/optional, not v1.

## 6. Roadmap (increments)

F1 is complete (`f1-complete`). F2 is in flight and is **finished & merged
before P1 build begins**.

| # | Increment | Delivers | Primary legacy reuse |
| --- | --- | --- | --- |
| **F2** | Runtime theme engine *(in flight → finish & merge)* | Per-brand → per-tenant CSS tokens; `BrandTheme` + `ThemeStyle` RSC | — |
| **P1** | **Tenancy foundation + auth** | `Blog`/`Membership`/`Domain` models, hostname→tenant middleware (subdomains), tenant-scoped data-access layer, **Clerk** (orgs=tenants, roles), **shadcn/Tailwind adopted** for the admin shell, **existing gr8loci migrated into "tenant 0"** → a working multi-tenant public blog on subdomains. **Shippable.** | AdminUser roles → Clerk |
| **P2** | **Content & authoring (block/page builder)** | Posts, pages, categories/tags, block editor on shadcn blocks, draft/publish — tenant-scoped. Public contact form with Turnstile. | BlogPost, categories/tags, HomePageContent, related-posts, contact form |
| **P3** | **Media (DO Spaces CDN)** | `Media` model, direct-to-Spaces upload, CDN delivery, accessible alt-text enforced, image blocks. Replaces `heroImageUrl` string. | S3 upload handler, env-prefixed paths |
| **P4** | **Custom domains** | Attach/verify custom domain per blog, automated Vercel domain provisioning + SSL, domain→tenant resolution. (Full-site Cloudflare considered & deferred — see §8.) | — |
| **P5** | **Notification banners** | Per-tenant **and** platform-wide banners — date-range, priority, dismissible. | `Announcement` (near-direct port) |
| **P6** | **Email subscriptions & newsletters** | Double-opt-in capture per blog (Turnstile-protected), Resend integration, new-post notifications, operator newsletter composer, unsubscribe, lead magnets. | EmailSubscriber, EmailCampaign, EmailTemplate, LeadMagnet |

**Ordering rationale:** P1 is foundational and independently shippable.
P2 (authoring) precedes P3 (media) to keep increments small — hero-image-by-URL
is the stopgap until P3 lands a real media subsystem.

## 7. Cross-cutting concerns

Folded into the relevant increment, not separate milestones:

- **Accessibility** — WCAG-minded components (shadcn/Radix is a good base),
  enforced alt-text on media, keyboard/focus correctness.
- **SEO** — per-tenant sitemap/robots; RSS optional/deferred.
- **Anti-bot** — Turnstile widget + server `siteverify` + honeypot on all public
  forms (contact in P2, signup in P6). One platform-wide Turnstile key with
  server-side hostname checks is the default (revisit per increment).
- **No local storage** — Postgres + DO Spaces only; enforced.
- **Tenant isolation discipline** — no unscoped Prisma in app code; tests guard
  cross-tenant leakage.

## 8. Deferred / escalation options (recorded, not adopted)

- **Full-site Cloudflare proxy.** Evaluated 2026-06-06. Rejected for now: Vercel
  recommends against reverse-proxying in front of it (buffers streamed
  responses, degrades performance, reduces Vercel Firewall's traffic visibility);
  it duplicates Vercel's built-in DDoS/WAF/CDN/SSL; and per-tenant custom domains
  would require adopting **Cloudflare for SaaS** (custom hostnames: first 100
  free, then $0.10/hostname/mo) as the domain layer instead of Vercel's. Reserve
  for sustained L7 attacks Vercel can't absorb, or a deliberate decision to let
  Cloudflare own custom domains + certs — either is a re-spec of **P4**, not a
  bolt-on.
- **Comments, full-text search, RSS** — not in v1; add as standalone increments
  if/when wanted.

## 9. Constraints & non-goals

- **No public signup / no billing** in this program (invited operators only).
- **No app-per-brand** — single multi-tenant app.
- **No local file storage** — ever.
- ML bot management, advanced analytics dashboards, and the legacy comment
  system are out of scope.

## 10. Actions triggered by this re-baseline

- Update `CLAUDE.md`: reverse the CSS-Modules-only rule (shadcn/Tailwind),
  state row-level multi-tenancy, pull Clerk forward, note DO Spaces media + no
  local storage, note Turnstile. *(Do as part of P1.)*
- Update `docs/superpowers/handoff/README.md` "What's next" to the P-series.
- **Finish & merge the F2 theme-engine branch** before P1 build.
- Next step after this vision is approved: **brainstorm P1 in detail** → its own
  spec + implementation plan.
