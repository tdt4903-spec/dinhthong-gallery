# DinhThong studio interface

The shared interface uses warm ivory, forest charcoal and emerald, with quieter
photographic backgrounds. `app/studio.css` defines shared visual tokens; page
classes scope changes to public, client, products, booking, finance and login.

Public pages use a photographic hero, editorial title and numbered collection
cards (three columns on desktop, two on phones, one below 360px). The header keeps
booking and theme controls. Category and album navigation retains existing URLs.

Management pages use solid header surfaces, compact overview and statistic cards,
consistent borders, table row hover and clear input focus. Booking uses separated
sections and a short introduction. Client albums use a compact summary above the
existing photo controls. Mobile form text remains at 16px to avoid focus zoom.

The theme choices, original media sources, download transport, face processing,
selection, sort and authorization logic are unchanged. Viewer touch geometry is
not targeted by the new layout rules. Reduced motion preferences are honored.

Validation: production build and TypeScript. Browser visual verification and
physical phone interaction still require a browser session.
