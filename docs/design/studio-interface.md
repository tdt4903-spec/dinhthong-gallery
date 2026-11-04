# DinhThong studio interface

The interface pairs warm ivory (#f6f5f0) and forest green (#173d32) with editorial
Georgia headings on public pages and compact sans-serif management screens.
Existing photography and Supabase records supply the portfolio and dashboards.
Page canvases remain transparent so the shared background shows through. The root
layout imports the user's `app/nen web.jpg` directly; CSS applies an 8px blur and
light/dark overlays that keep the image visible. The source photograph is not
modified. Headers, cards, and dialogs retain their own readable surfaces.

## Public portfolio and sign-in

`app/PublicGalleryPage.tsx` and `app/public-home.module.css` implement a split
photographic hero, numbered collections, searchable albums, category filters,
about section, and booking links. Loading, retry, empty, and no-results states are
explicit. Collection URLs and public album URLs retain their existing routes.
Light/dark mode and reduced-motion preferences remain available.

`app/admin/page.tsx` and its CSS module provide the matching photographic sign-in
screen, Google OAuth action, inline connection feedback, and permission note.
Existing account checks and localhost development behavior remain in place.

## Management workspace

`components/studio/StudioWorkspace.tsx` and `app/management.css` provide a common
sidebar, route indicator, portfolio shortcut, and keyboard-accessible mobile
drawer. Account details and sign-out sit below the navigation. The layouts for
`/dashboardadmin`, `/dashboardpublic`, `/dashboardsp`, and `/money` wrap their
existing pages. Private data and actions continue to use each page's existing
authorization checks.

- **Gallery:** real album/viewer/selection counts, album library,
  customer selection activity, and a separate maintenance disclosure.
- **Public portfolio management:** collection visibility and album publication settings.
- **Products:** contextual category filters, an inline category form, a category
  management drawer, and the existing album tools.
- **Booking:** request/status/package counts, calendar, service/package controls,
  payment settings, and customer requests.
- **Finance:** income, expense, and balance cards that respect balance privacy;
  transaction, history, import/export, and report tools remain available. Below
  1280px the content uses a single-pane layout to accommodate the sidebar.
- **Key Panel:** license counts, serial/customer search, duration controls, and
  existing generation/copy/revoke/delete actions. The `?panel=keys` URL and
  `studio:open-key-panel` / `studio:close-key-panel` events synchronize navigation.
  Nested confirmation dialogs retain keyboard ownership.

Management navigation is hidden for `.studio-gallery-detail`, preserving the
full-width album and photo viewer. Shared navigation layers sit below dialogs.
Original download, face processing, selection, sorting, and license APIs remain
in place. No sample records are inserted into the application.

## Verification

Run `npx tsc --noEmit`, `npm run build`, and `git diff --check`. Browser QA covers
desktop and phone portfolio/gallery/key layouts, menu open/Escape behavior, and
operations layouts using isolated browser request fixtures for authenticated
screens. These fixtures live outside the repository and do not alter account
permissions or production records. Physical touch and a live Google OAuth
round-trip remain separate manual checks.
