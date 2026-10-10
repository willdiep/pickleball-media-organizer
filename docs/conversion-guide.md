# Conversion guide

Step-by-step plan for moving Pickleball Media Organizer from Electron, React, shadcn/ui, and npm to Tauri, Solid.js, [SolidUI](https://www.solid-ui.com), and Bun.

Do the phases in order. Each phase should build and run before the next one starts. Do not land all four in a single change.

| Phase | From | To | App gets faster? |
| --- | --- | --- | --- |
| 1 | npm | Bun | No. Installs and scripts get faster. |
| 2 | React | Solid.js | Only when the gallery is large. |
| 3 | shadcn/ui | SolidUI | No. Do this in the same change as phase 2. |
| 4 | Electron + Prisma | Tauri + SQLite | Yes: startup, memory, and installer size. Not video decode. |

Phase 3 cannot wait until after phase 2 is finished and merged on its own if the shadcn components are still React. Replace those components while rewriting the screens. They are split below so each library has its own checklist.

## What this repo uses today

Keep this map next to you. The behavior to preserve is small.

Native bridge (`preload.cjs`, typed in `src/types/electron.d.ts`):

| Current IPC | What it does |
| --- | --- |
| `media:list` | All media, newest first, plus every tag |
| `media:add-folder` | Native directory dialog, then ingest |
| `media:get` | One item by id |
| `media:update-tags` | Replace tags on one item; create missing tags |
| `media:update-description` | Trimmed description, empty becomes null |
| `media:delete` | Delete join rows, then the media row |
| `tags:list` | Tags ordered by name |

Ingest rules live in `main.ts`:

- Videos: `.mp4`, `.mov`, `.m4v`, `.webm`, `.avi`
- Photos: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Identity is the absolute filepath (`Media.filepath` is unique)
- New rows get a UUID
- Returned items add `fileUrl` and flatten `tags` to `{ id, name }[]`

Screens to rewrite:

- `src/main.tsx`
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/components/MediaCard.tsx`
- `src/components/MediaModal.tsx`
- `src/components/VideoJS.tsx`
- `src/components/TagBadge.tsx`
- `src/components/ui/*` (button, card, input, label, textarea, separator, spinner)

Leave `src/components/MediaCard--old.tsx` behind. Do not port it.

Database tables from `prisma/schema.prisma` and `prisma/migrations/`:

- `Media` (`created_at`, `updated_at`, nullable `description`)
- `Tag` (`name` unique)
- `MediaTag` (composite primary key)

The running dev database, when Electron starts with no `DATABASE_URL` in the environment, is `data/pickleball.db` under the project root. Prisma CLI resolves a relative `file:./data/pickleball.db` from the `prisma/` folder instead. Phase 4 should open the root `data/pickleball.db` file if existing libraries must be kept.

## Phase 1 — npm to Bun

Bun replaces the package manager and script runner only. Electron, React, and Prisma stay.

### 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

Use Bun 1.1 or newer.

### 2. Install from the existing lockfile

From the repo root:

```bash
bun install
```

`postinstall` runs `prisma generate`. Confirm `node_modules/.prisma/client` exists afterward.

If Electron’s download script fails under Bun, run `bun install` once with npm’s Electron mirror vars, or install Electron with `npm install electron@28` a single time and then keep using Bun. Do not debug that by changing application code.

### 3. Point scripts at Bun

In `package.json`:

- Add `"packageManager": "bun@<version>"` using the version from `bun --version`.
- Change `dev:main` so it does not call `npm run`:

```json
"dev:main": "bun run build:main && wait-on http://localhost:5173 && electron ."
```

`bun run dev`, `bun run build`, and `bun run prisma:generate` should replace every `npm run` / `npx` command in local docs and shell habits. `bunx prisma migrate deploy` and `bunx tsc -p tsconfig.main.json` are the Bun equivalents of `npx`.

### 4. Swap the lockfile

After `bun install` succeeds and `bun run dev` opens the current Electron app:

1. Commit `bun.lock`.
2. Delete `package-lock.json`.
3. Add `package-lock.json` to `.gitignore` only if contributors might regenerate it by mistake. Prefer deleting it and not ignoring a file that should not exist.

### 5. Check phase 1

- `bun run dev` opens Pickleball Media Organizer.
- The gallery lists existing rows from `data/pickleball.db`.
- Add Folder still imports a directory.
- Save a tag and a description, restart, and confirm both are still there.

Stop here and commit. Later phases assume `bun run` is the only install and script path.

## Phase 2 — React to Solid.js

Stay on Electron for this phase. `preload.cjs` and `window.electronApi` stay as they are, so the data layer does not move yet.

SolidUI components replace the shadcn files during this phase (phase 3). Rewriting a screen onto Solid and then importing a React button will not compile.

### 1. Swap the framework packages

```bash
bun remove react react-dom @types/react @types/react-dom @vitejs/plugin-react
bun remove @radix-ui/react-label @radix-ui/react-separator @radix-ui/react-slot lucide-react
bun add solid-js
bun add -d vite-plugin-solid
```

Keep `video.js`, `videojs-hotkeys`, `plyr` (if still referenced), `clsx`, `tailwind-merge`, and `class-variance-authority`. Those are not React-specific. `plyr` is a dependency today but the preview uses Video.js; drop `plyr` if nothing imports it after the rewrite.

### 2. Point Vite and TypeScript at Solid

`vite.config.ts`:

```ts
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  // keep the existing "@" alias, port 5173, and dist outDir
});
```

`tsconfig.app.json`:

- Set `"jsx": "preserve"` and `"jsxImportSource": "solid-js"`.
- Remove any React types from `compilerOptions.types`.

`index.html` can keep `<script type="module" src="/src/main.tsx">`.

Tailwind `content` already includes `./src/**/*.{ts,tsx}`. Leave that.

### 3. Replace the entry file

Replace `src/main.tsx` with:

```tsx
import { render } from "solid-js/web";
import App from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

render(() => <App />, root);
```

Do not wrap the tree in `StrictMode`. Solid does not double-invoke setup the way React 18 does, which is what the Video.js comment in `VideoJS.tsx` is defending against.

### 4. Rewrite state

Apply these rules in `App.tsx`, `MediaModal.tsx`, and `VideoJS.tsx`.

| React | Solid |
| --- | --- |
| `useState(x)` | `const [x, setX] = createSignal(x)`. Read with `x()`. |
| `useMemo(() => ..., [deps])` | `createMemo(() => ...)`. Memories track signals read inside. |
| `useEffect` | `createEffect`, or `onMount` / `onCleanup` when it is DOM setup |
| `useRef` | `let el: HTMLDivElement \| undefined` and `ref={el}` for DOM. A stored player instance can be a plain `let`. |
| `useCallback` | A plain function. Solid does not re-render children because a function identity changed. |
| `{list.map(...)}` | `<For each={list()}>{(item) => ...}</For>` |
| Conditional mount | `<Show when={selected()}>{(item) => ...}</Show>` |

Do not destructure props (`const { media } = props`). Read `props.media` so updates keep flowing.

Input events: use `onInput`, not React’s `onChange`. Solid’s `onChange` is the DOM `change` event and will not update a tag field on each keystroke.

Use `class`, not `className`.

`window.electronApi` calls stay async and identical. Only the state around them changes. Example shape for the gallery:

```tsx
const [media, setMedia] = createSignal<NormalizedMedia[]>([]);
const [selectedTag, setSelectedTag] = createSignal("all");

const filtered = createMemo(() => {
  const tag = selectedTag();
  if (tag === "all") return media();
  return media().filter((item) => item.tags.some((t) => t.name === tag));
});
```

Call `setMedia` with a new array when a save returns. Inside a card, do not reach for other cards’ signals.

### 5. Port Video.js

Video.js still mutates a DOM node. Port `src/components/VideoJS.tsx` like this:

1. `onMount`: create the `<video-js>` element, append it, call `videojs(...)`.
2. Enable `hotkeys` with `seekStep: 0.1` when the plugin attached a function, same as today.
3. `onCleanup`: `player.dispose()`.
4. When `props.options` changes, `createEffect` should call `player.src(...)` instead of constructing a second player.

The existing `PlayerWithHotkeys` interface does not typecheck against Video.js (`hotkeys` is required on the plugin type, optional on the wrapper). Fix that while touching the file: intersect the player with `{ hotkeys?: (options?: { seekStep?: number }) => void }` instead of extending `Player`.

### 6. Port each screen

Keep the visible layout, copy, and emerald actions.

- `Sidebar.tsx`: `<For>` over tags. The selected button compares `props.selectedTag` to `"all"` or `tag.name`.
- `MediaCard.tsx`: photo uses `<img>`, video uses a muted `<video preload="metadata">`. Clicking still calls `props.onSelect(props.media)`.
- `MediaModal.tsx`: local signals for `tagInput`, `tagList`, and `description`. Reset them in `createEffect` when `props.media` changes. Escape still closes. Enter or comma still adds a tag. Save still calls `props.onSave` then `props.onClose`. Delete still calls `props.onDelete`.
- `TagBadge.tsx`: presentational. No state.

`fileUrl` is still whatever the Electron main process put on the object (`pathToFileURL`). Do not invent a new URL scheme until phase 4.

### 7. Check phase 2

- `bun run dev` still launches Electron, and Vite still serves port 5173.
- No amber “Electron bridge not detected” banner.
- Filter by a tag, add a tag, edit a description, delete an item.
- Open a video and confirm seek hotkeys still step by 0.1 seconds.
- `bunx tsc --noEmit -p tsconfig.app.json` passes.

Commit before starting the Tauri rewrite. The app is still an Electron app with a Solid UI.

## Phase 3 — shadcn/ui to SolidUI

Do this while phase 2 is in progress, before that branch is considered done. SolidUI is the Solid equivalent of shadcn: components are copied into the repo, styled with Tailwind, and built on Kobalte and corvu.

### 1. Initialize SolidUI

From the repo root, after Solid and Vite are in place:

```bash
bunx solidui-cli@latest init
```

Accept the defaults that match this repo:

- TypeScript
- Tailwind config: `tailwind.config.cjs`
- CSS: `src/index.css`
- Alias: `@/components` and `@/lib/utils`
- Component directory: `src/components/ui`

`src/lib/utils.ts` (`cn` via `clsx` and `tailwind-merge`) can stay. If the CLI wants to replace it, keep the same function signature.

The CLI will add CSS variables. This project already has the shadcn variables in `src/index.css` (`--background`, `--primary`, `--radius`, and the `.dark` block). Merge; do not drop the Manrope font or `.scrollbar-light`.

### 2. Add the components this app actually uses

```bash
bunx solidui-cli@latest add button card textarea separator text-field
```

Map the current files:

| Delete after the screens compile | SolidUI replacement |
| --- | --- |
| `src/components/ui/button.tsx` | `button` |
| `src/components/ui/card.tsx` | `card` |
| `src/components/ui/input.tsx` | `text-field` (`TextField`, `TextFieldInput`) |
| `src/components/ui/label.tsx` | label that ships with `text-field` / `textarea` |
| `src/components/ui/textarea.tsx` | `textarea` |
| `src/components/ui/separator.tsx` | `separator` |
| `src/components/ui/spinner.tsx` | Inline SVG, or the Lucide set from `solid-icons` |

There is no Radix `Slot` / `asChild` in SolidUI’s button. This app does not use `asChild` outside the button primitive, so drop that prop.

Spinner is only the Loader icon in the Add Folder button. A 16px SVG with `animate-spin` is enough. If you want the Lucide set:

```bash
bun add solid-icons
```

```tsx
import { Loader2 } from "solid-icons/lu";
```

Use the icon name the package exports for the loader glyph. Do not keep `lucide-react`.

### 3. Rewire call sites

- `App.tsx`: SolidUI `Button`. The loading state stays the spinner plus the word “Loading”.
- `MediaCard.tsx`: SolidUI `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardFooter`.
- `MediaModal.tsx`: SolidUI `Button`, `TextField` / `TextFieldInput`, and `Textarea`. Keep the custom fixed overlay unless you choose SolidUI `Dialog`. A dialog is optional; the current modal already handles Escape, scroll, and a two-column layout. Do not restyle the emerald actions away.

SolidUI inputs are controlled with signals:

```tsx
<TextField value={tagInput()} onChange={setTagInput}>
  <TextFieldInput
    placeholder="Add tag (press Enter or comma)"
    onKeyDown={handleKeyDown}
  />
</TextField>
```

Confirm the prop names against the copied source in `src/components/ui`. SolidUI components are owned by the repo, same as shadcn, so a wrong prop is fixed in the copied file or at the call site. Prefer the call site.

### 4. Check phase 3

- Add Folder, card, tag field, description, Cancel, Save Changes, and Delete still look like the current gallery.
- Focus rings and disabled state still show on the buttons.
- `components.json` is the shadcn React config. Replace it with the `ui.config.json` the SolidUI CLI writes, or delete `components.json` so nobody runs the React shadcn CLI against this repo.

Commit together with phase 2, or as the immediate next commit on that branch.

## Phase 4 — Electron to Tauri

Start this only after the Solid UI is stable. This phase deletes the Node main process. Prisma does not run inside Tauri’s Rust process. Do not shell out to Node to keep Prisma; that spends the memory win phase 4 exists to get.

Rust and a C toolchain are required (`rustup`, `build-essential`, and the Tauri Linux packages from the [Tauri prerequisites](https://tauri.app/start/prerequisites/)). On this machine WebKitGTK is the webview.

### 1. Prove codecs before deleting Electron

Tauri on Linux uses WebKitGTK, not Chromium. Playback of `.mov`, `.m4v`, and `.avi` can fail even when Electron plays them. `.mp4` and `.webm` are the formats to treat as required.

Build a throwaway Tauri window that only plays one file of each extension via `convertFileSrc` before porting ingest. If a format the library needs is silent or black, stop and stay on Electron, or transcode on import. Do not discover this after `main.ts` is gone.

### 2. Add Tauri to the existing Vite app

```bash
bun add @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-sql
bun add -d @tauri-apps/cli
bunx tauri init
```

When the CLI asks:

- Dev URL: `http://localhost:5173`
- Frontend dev command: `bun run dev:renderer`
- Frontend build command: `bun run build:renderer`
- Dist directory: `../dist` relative to `src-tauri`

In `vite.config.ts` set `server.strictPort: true`, `clearScreen: false`, and `envPrefix: ["VITE_", "TAURI_"]`.

Replace the Electron scripts:

```json
"dev": "bunx tauri dev",
"build": "bunx tauri build",
"start": "bunx tauri dev"
```

Remove `dev:main`, `build:main`, `start`’s Electron path, and the `electron .` main entry. `package.json` `"main": "dist-main/main.js"` must go.

### 3. Replace the IPC bridge

Add `src/lib/media-api.ts` that calls Tauri commands and returns the same shapes as `src/types/media.ts`. Screens import that module instead of `window.electronApi`.

| Old `electronApi` method | Tauri command |
| --- | --- |
| `listMedia()` | `list_media` |
| `addFolder()` | dialog in the webview, then `ingest_folder` |
| `getMedia(id)` | `get_media` |
| `updateTags(id, tags)` | `update_tags` |
| `updateDescription(id, description)` | `update_description` |
| `deleteMedia(id)` | `delete_media` |
| `listTags()` | `list_tags` |

Frontend folder pick:

```ts
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

const folder = await open({ directory: true, multiple: false });
if (typeof folder !== "string") return;
await invoke("ingest_folder", { directory: folder });
```

Register the dialog and SQL plugins in `src-tauri/src/lib.rs` (or `main.rs`, wherever `tauri::Builder` lives) and grant them in `src-tauri/capabilities/default.json`.

Delete `preload.cjs`, `src/types/electron.d.ts`, and every `window.electronApi` branch. The “bridge not detected” banner goes away because there is no browser-only mode unless you add one on purpose.

### 4. Replace Prisma with the SQL plugin

Copy the SQL out of:

- `prisma/migrations/20251208060206_init/migration.sql`
- `prisma/migrations/20251210084652_add_media_description/migration.sql`

Feed those statements to `tauri_plugin_sql::Builder::add_migrations` for the connection string `sqlite:pickleball.db`.

Put the file in the app data directory, or open the existing project database with an absolute path if developers must keep `data/pickleball.db`. Plugin-sql creates a new file in the app config directory by default. An old Prisma file is not picked up unless the connection string points at it.

Load it once from Rust (commands use the same connection) or from the frontend with:

```ts
import Database from "@tauri-apps/plugin-sql";

const db = await Database.load("sqlite:pickleball.db");
```

Prefer Rust commands that run the SQL. The webview should not be the place that walks disks or writes tags. Mirror the Prisma transactions:

- `update_tags`: normalize names (`trim`, lowercase, drop empties), insert missing `Tag` rows, delete `MediaTag` for that media id, insert the new pairs.
- `update_description`: blank string becomes `NULL`.
- `delete_media`: delete `MediaTag` rows first, then `Media`. The foreign keys are `ON DELETE RESTRICT`.
- `list_media`: order by `created_at DESC`, attach tags ordered by name.

`created_at` / `updated_at` are the real column names. Set `updated_at` yourself on update; SQLite will not refresh it the way Prisma did.

UUID for new rows: the `uuid` crate in Rust, stored as text, same as `crypto.randomUUID()`.

### 5. Port ingest and local file URLs

Port `walkDirectory` and `inferMediaType` to Rust (`walkdir` is fine). Skip unsupported extensions and count them as `skipped`, same as `main.ts`. Upsert on filepath: insert if missing, leave existing rows unchanged on import (`update: {}` today).

After a directory is chosen, allow that directory on the asset protocol scope before any `<img>` or `<video>` loads it:

```rust
app.asset_protocol_scope().allow_directory(&directory, true)?;
```

Do this again for every filepath already in the database when the app starts, or those old items will not render.

Enable the asset protocol in `tauri.conf.json` and set a CSP that allows images and media from `asset:` and `https://asset.localhost`. Do not grant the whole home directory up front.

On the frontend, stop using `file://` and `pathToFileURL`. Build the URL with:

```ts
import { convertFileSrc } from "@tauri-apps/api/core";

const fileUrl = convertFileSrc(media.filepath);
```

`MediaCard` and `MediaModal` already consume `fileUrl`. Keep that field so the components do not learn about Tauri.

On Linux, WebKitGTK plays `file://` and `http://` video, but its GStreamer media pipeline does not load the `asset://` custom protocol (images through that protocol are fine). Videos therefore use `http://127.0.0.1:17421/media?path=...`, a loopback server that only serves files under folders already imported into the library. Photos stay on `convertFileSrc`. `.mp4`, `.webm`, `.mov`, and `.avi` play when GStreamer has `gstreamer1.0-libav` (and plugins-good for VP8/WebM).

External links, if any are opened later, go through `@tauri-apps/plugin-shell` `open`. The current main process uses `shell.openExternal` for `window.open`.

### 6. Remove Electron and Prisma

After `bun run dev` is the Tauri app and the checklist below passes:

```bash
bun remove electron @prisma/client
bun remove -d prisma concurrently wait-on
```

Delete:

- `main.ts`
- `preload.cjs`
- `dist-main/`
- `tsconfig.main.json`
- `prisma/` (only after the SQL migrations have been copied and an existing `data/pickleball.db` has been opened successfully)
- Electron-only scripts and the `postinstall` Prisma generate hook

Keep `data/*.db` gitignored.

### 7. Check phase 4

- Cold start shows the same gallery as Electron did for the same database file.
- Add Folder on a directory with a mix of photos, mp4, and one unsupported file returns imported and skipped counts.
- Importing the same folder again does not duplicate rows.
- Tag create, tag filter, description clear, and delete match the old IPC behavior.
- A photo and an mp4 render through `convertFileSrc`.
- A `.mov` or `.avi` from the codec spike in step 1 either plays or is documented as unsupported.
- `bun run build` produces a Tauri bundle.
- DevTools are not required for the app to function. Electron opened them detached in development; Tauri’s inspector is optional.

## Suggested commit split

1. `chore: use bun as the package manager`
2. `feat: rewrite the ui in solid and solidui`
3. `feat: replace electron and prisma with tauri`

Run the phase checklist before each commit. Keep Electron on `main` until phase 4 has played real library files.
