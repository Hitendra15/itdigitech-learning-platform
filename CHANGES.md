# Website CMS and UI/UX transformation: change report

## Summary
The public site, company details and promotions are now managed from Console → Website. No festival, offer, statistic or homepage copy lives in frontend code. A shared design system (ink neutrals, cobalt primary, one typeface, small radius/shadow scale) now drives the learner app, public site and console.

## Backend (`backend/apps/website`, new)
Models: `MediaAsset`, `HomeSection` (live fields + `draft` JSON), `PromoBanner`. Company profile and SEO reuse `SiteSetting` (key `website-profile`).
Migrations: `0001_initial`, `0002_default_homepage` (seeds default sections on empty installs only).
`schemas.py` declares every editable field once; it drives validation, console forms and image resolution.

Public endpoints (no auth, own throttle scope `site`, 1500/hour):
- `GET /api/v1/site/config`: profile + live promotions
- `GET /api/v1/site/home`: published, enabled, non-empty sections in order

Admin endpoints (`IsAdminRole`, audited), under `/api/v1/admin-api/website/`:
- `schema`, `profile` (GET/PUT)
- `sections` (list/create/patch/delete), `sections/reorder`, `sections/{id}/discard`
- `home/status`, `home/preview`, `home/publish`, `home/discard`
- `promotions` (CRUD, `?status=`, `?search=`), `promotions/{id}/duplicate`
- `media` (list/upload/patch/delete; delete returns 409 while in use)

Other: `seed_website [--reset]` command; settings `WEBSITE_MAX_IMAGE_MB`, throttle scope `site`.

## Frontend
New: `site/{SiteContext,SmartLink,PromoBanner,sections,seo,icons}`, `site/widgets.css` (chat/lab/certificate styles, moved unchanged), `console/website/*` (Homepage, SectionEditor, Preview, PreviewFrame, Promotions, PromotionEditor, MediaLibrary, SiteProfile, SchemaForm, ImagePicker), `console/website.css`.
Rewritten: `site/{Home,PublicLayout,Pricing,shared,config}`, `site/site.css`, tokens and primitives in `styles.css` and `console.css`.
Modified: `Courses`, `Contact` (profile-driven), `ChatWidget` (hours from profile; hidden on preview), `App`, `main`, `AdminRoutes`, `AdminLayout`, `Plans` (placeholder), `Modal` (focus bug fix), `index.html` (Inter).
Removed: `SITE.sale/stats/testimonials`, the hardcoded offer markup, fake product mockups, the `mw-` styles.

## Tests
Backend 98 passed (42 new in `tests/test_website.py`). Frontend 48 passed (new `console/website/website.test.jsx`; rewritten site tests). Production build succeeds.

## Before deploying
1. Run migrations.
2. Recreate the current sale in Console → Promotions (coupon-linked, with end date).
3. Rotate any secrets that were in `backend/.env`.
4. Add real images and alt text in the media library; fill in Website settings (email, phone, legal links, SEO).

## Known gaps
No drag-and-drop reordering (up/down buttons); no dashboard status card; learner pages (course player, tests, payments) and tablet widths got only the token-level restyle, not a visual review; not run on Postgres; the global anonymous throttle (100/hour) still applies to existing public endpoints.
