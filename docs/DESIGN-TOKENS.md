# Design tokens (Lazidrome)

Radius, typography, spacing, motion, z-index, and semantic colors.

## Border radius (D6)

| Role | Class | Usage |
|------|-------|--------|
| Card / panel | `rounded-xl` | List wrappers, album/artist cards, empty states |
| Dialog | `rounded-xl` | shadcn `DialogContent` |
| Input | `rounded-md` | Form fields |
| Pill CTA | `rounded-full` | Play buttons, load-more |
| Thumbnail | `rounded-lg` | Queue covers, tabs |
| Avatar | `rounded-full` | Artist images |

Hero only (full player cover): `rounded-2xl` / `rounded-3xl` allowed.

## Semantic colors (D4)

Defined in `frontend/src/style.css`:

| Token | Tailwind | Usage |
|-------|----------|--------|
| `--favorite` | `text-favorite` | Heart / favorite |
| `--rating` | `text-rating` | Star ratings, metadata sparkle |
| `--success` | `text-success`, `bg-success/10` | New entity badges, external match OK |
| `--smart` | `text-smart`, `bg-smart` | Smart playlist / mix UI |
| `--destructive` | `text-destructive` | Delete, remove from playlist |

Avoid raw `red-500`, `green-500`, `purple-500`, `yellow-500` in product UI.

## Typography (D7)

| Role | Class | Usage |
|------|-------|--------|
| Page title | `text-2xl md:text-3xl font-bold tracking-tight` | `ViewHeader` |
| Section title | `text-lg font-bold` | `SectionHeader` |
| Body | `text-sm md:text-base` | Descriptions, bio |
| Label / meta | `.text-label` or `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | Filters, stats |
| Table primary | `text-sm font-semibold` | Track title cells |

## Spacing (D8)

| Area | Convention |
|------|------------|
| Page shell | `App.vue` main: `px-4 pt-6 md:px-12 md:py-10` |
| Page sections | `PageLayout` default `spacing="8"` → `space-y-8` |
| Detail sections | `space-y-6` between blocks |
| Loading / empty | `py-16` via `LoadingSpinner` / `EmptyState` |

## Z-index (D9)

| Token | Value | Usage |
|-------|-------|--------|
| `--z-overlay` | 70 | Queue drawer |
| `--z-dialog` | 100 | Hand-rolled dialog overlays (`fixed inset-0`) |
| `--z-dropdown` | 110 | Dropdown, select and popover menus |
| `--z-player` | 200 | Full player overlay |

Dropdown sits **above** dialog on purpose. Select and popover content is
teleported to `<body>`, so a dialog overlay at 100 would otherwise paint over the
menu and swallow its clicks — the control then looks frozen on its initial value.

Player chrome sits above dropdowns; do not raise dropdown above `--z-player`.

## Motion (D11)

| Utility | Usage |
|---------|--------|
| `.transition-ui` | Hover/focus on buttons, cards, list rows (`200ms`) |
| `--motion-fast` | 150ms — micro feedback |
| `--motion-normal` | 200ms — default |

Prefer `transition-ui` over ad-hoc `duration-300` on interactive controls.

## Layout components

- `FavoriteButton`, `StarRating` — interactive metadata
- `LoadingSpinner`, `EmptyState` — list states (`rounded-xl` panel variant)
- `VirtualScrollGrid` — responsive catalog grid (page scroll, no inner scroll)
- `SafeImage` — lazy cover + viewport signing

## Accessibility (D10)

- Icon-only buttons: `aria-label` (see `TrackListToolbar`, player controls)
- Focus: `focus-visible:ring-2 focus-visible:ring-ring` on custom buttons
- Context menus: checkbox items for favorite state
