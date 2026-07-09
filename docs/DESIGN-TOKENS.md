# Design tokens (Lazidrome)

Radius, semantic colors, and layout conventions used across the app.

## Border radius

| Role | Class | Usage |
|------|-------|--------|
| Card / panel | `rounded-xl` | List wrappers, album/artist cards, queue panel |
| Dialog | `rounded-xl` | shadcn `DialogContent` default |
| Input | `rounded-md` | Form fields (shadcn `Input`) |
| Pill CTA | `rounded-full` | Play buttons, load-more, player chips |
| Thumbnail | `rounded-lg` | Queue covers, small art |
| Avatar | `rounded-full` | Artist images in tables |

Avoid mixing `rounded-2xl` / `rounded-3xl` on standard cards unless it is a hero (full player cover).

## Semantic colors (CSS variables)

Defined in `frontend/src/style.css`:

- `--favorite` / `text-favorite` — heart / favorite actions
- `--rating` / `text-rating` — star ratings
- `--destructive` — delete / remove (prefer over raw `red-500`)
- Theme neutrals: `--background`, `--foreground`, `--border`, `--muted`, `--primary`

## Spacing

- Page shell: `App.vue` main padding `px-4 pt-6 md:px-12 md:py-10`
- List sections: `PageLayout` spacing `8` default
- Loading / empty blocks: `py-16` via `LoadingSpinner` / `EmptyState`

## Shared components

- `FavoriteButton`, `StarRating` — interactive metadata
- `LoadingSpinner`, `EmptyState` — list states
- `VirtualScrollGrid` — paged album/artist grids
- `SafeImage` — lazy cover + viewport signing (`signType` / `signId`)
