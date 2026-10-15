# Improvement plan

Step-by-step plan for the ten UI and functionality themes from the review of Pickleball Media Organizer.

Do the phases in order. Each phase should build and run before the next one starts. Do not land all ten in a single change.

| Phase | Theme |
| --- | --- | --- |
[X] | 1 | Import is a black box |
[X] | 2 | The library cannot stay in sync with disk |
[ ] | 3 | Finding things stops at one tag |
[ ] | 4 | Tagging is one item at a time, then the viewer closes |
[ ] | 5 | Playback is aimed at portrait phone clips |
[ ] | 6 | Delete is the whole settings menu |
[ ] | 7 | The empty state lies when a filter matches nothing |
[ ] | 8 | The grid is mouse-only |
[ ] | 9 | The viewer is dense in the wrong places |
[ ] | 10 | The shell does not adapt |

Phase 3 lands before phase 7, so a search or tag that matches nothing uses a one-line "No matches" message. Phase 7 replaces that line with the two empty cards and the header label. Do not build that header twice.

Dropping a folder onto the window is not part of these ten themes. Leave it out.

## What this repo uses today

Keep this map next to you. The behavior to preserve is the library itself: files stay on disk when a row is deleted, a filepath is unique, and a re-import must not wipe tags or descriptions.

Commands registered in `src-tauri/src/lib.rs`:

| Command | What it does |
| --- | --- |
| `list_media` | All media plus every tag |
| `list_tags` | Tags ordered by name. The UI does not call it. |
| `get_media` | One item by id. The UI does not call it. |
| `ingest_folder` | Allow the directory, walk it, return the library plus `imported` and `skipped` |
| `update_tags` | Replace tags on one item. Creates missing tags. Returns that item and every tag. |
| `update_description` | Trimmed description. Empty becomes null. |
| `delete_media` | Delete join rows, then the media row. Returns the library. |
| `delete_all_media` | Delete join rows, media rows, and tags. |

The webview calls those through `src/lib/media-api.ts`. `addFolder()` opens the native directory dialog, then invokes `ingest_folder`. Videos are served from `http://127.0.0.1:17421`. Photos use `convertFileSrc`.

Ingest rules in `src-tauri/src/db.rs`:

- Videos: `.mp4`, `.mov`, `.m4v`, `.webm`, `.avi`
- Photos: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Identity is the absolute filepath (`Media.filepath` is unique)
- `ON CONFLICT(filepath) DO UPDATE` refreshes `group_path` only
- Files directly in the chosen root stay ungrouped. Files under an immediate child directory share that directory, including nested files.
- `created_at` is `datetime('now')` at insert time

Screens:

- `src/App.tsx` holds the library, the selected tag, and the open carousel
- `src/components/Sidebar.tsx` filters by one tag
- `src/components/MediaCard.tsx` is the grid card and the video poster cache
- `src/components/MediaModal.tsx` is the viewer, the tag editor, and the delete confirm
- `src/components/VideoJS.tsx` wraps Video.js. Hotkeys seek by 0.1 seconds.
- `src/components/AppMenuModal.tsx` is the Ctrl+, dialog. Its only action is Delete all.
- `src/lib/gallery.ts` groups by `groupPath` and sorts by newest `createdAt`
- `src/lib/media-ratio.ts` stores a width/height ratio and nothing imports it

Database tables, after `src-tauri/migrations/001_init.sql` through `003_group_path.sql`:

- `Media` (`created_at`, `updated_at`, nullable `description`, nullable `group_path`)
- `Tag` (`name` unique)
- `MediaTag` (composite primary key, `ON DELETE RESTRICT`)

The dev database is `data/pickleball.db` under the project root. `db::database_file` creates that directory.

## Phase 1 — Import is a black box

`ingest_folder` already returns counts. `handleAddFolder` in `src/App.tsx` ignores them, and a filepath conflict still increments `imported` because the `INSERT ... ON CONFLICT DO UPDATE` runs. Failures only hit `console.error`. The header button disables while `isAdding` is true. The empty-state button does not.

### 1. Count inserts separately from conflicts

In `src-tauri/src/db.rs`, change `ingest_directory` so it returns three integers: `imported`, `already_present`, and `skipped`.

Before the upsert, look up the filepath:

```rust
let existed: bool = tx
    .query_row(
        "SELECT 1 FROM Media WHERE filepath = ?1",
        [&filepath],
        |_| Ok(1),
    )
    .optional()?
    .is_some();
```

Run the same upsert as today. If `existed` is true, increment `already_present`. Otherwise increment `imported`. A conflict still updates `group_path` only, and still keeps the description and tags.

`skipped` stays the count of files whose extension is not a known photo or video, plus files whose name is not valid Unicode.

`rusqlite::OptionalExtension` is the trait that adds `.optional()`.

### 2. Return the three counts

`IngestPayload` in `db.rs` and the `ingest_folder` command in `src-tauri/src/commands.rs` gain `already_present`. `imported` means newly inserted rows.

```rust
pub struct IngestPayload {
    pub imported: i64,
    pub already_present: i64,
    pub skipped: i64,
    pub media: Vec<MediaRecord>,
    pub tags: Vec<TagRecord>,
}
```

Mirror that on `AddFolderResponse` in `src/types/media.ts` and on the object `addFolder()` returns in `src/lib/media-api.ts`.

Update `ingest_groups_subdirectory_media_and_leaves_root_files_alone`. The first walk of that fixture reports the new files as `imported` and `notes.txt` as `skipped`. The second walk reports `imported == 0`, `already_present == 4`, `skipped == 1`, and `a1.png` still has description `"keep me"`.

### 3. Report progress while the walk runs

The command blocks until the walk finishes. Emit a Tauri event from inside the loop so the window can show that work is happening.

```rust
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestProgress {
    pub scanned: u64,
    pub imported: u64,
    pub already_present: u64,
    pub skipped: u64,
}
```

Pass `AppHandle` into the walk and `emit("ingest-progress", progress)` every 25 files, and once more after the transaction commits. `ingest_folder` already has `AppHandle`.

In `App.tsx`, `listen("ingest-progress", ...)` while `isAdding` is true. Show `Importing… {scanned} files` on the header subtitle. Unlisten when the import settles.

### 4. Show the result, and show the failure

`addFolder()` returns `{ imported: 0, skipped: 0 }` with no `media` when the directory dialog is cancelled. Leave the grid alone and show no message.

On success, set a header line and clear it when the next import starts:

```tsx
const parts = [`Added ${result.imported}`];
if (result.alreadyPresent) parts.push(`${result.alreadyPresent} already in the library`);
if (result.skipped) parts.push(`skipped ${result.skipped}`);
setImportSummary(parts.join(", "));
```

On failure, set `loadError` to the error message and leave `media` as it was. Remove the `console.error`-only path.

Both Add folder buttons take `disabled={isAdding}`. The empty-state button uses the same spinner and "Importing" label as the header button.

### 5. Check phase 1

- A new folder reports only the files that were inserted.
- Importing that folder again reports already-present, and tags and descriptions are still there.
- The subtitle updates while a large folder is scanning.
- Cancelling the dialog shows no message.
- A failed import shows the error in the header and does not clear the grid.
- Both Add folder buttons are disabled for the duration of the import.

Stop here and commit.

## Phase 2 — The library cannot stay in sync with disk

The library remembers file paths, not the folder the user picked. Nothing checks that a file is still on disk, nothing opens the file manager, and `created_at` is the insert time. HEIC and HEIF are skipped.

### 1. Remember the folder that was imported

Add `src-tauri/migrations/004_library_root.sql`:

```sql
CREATE TABLE "LibraryRoot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LibraryRoot_path_key" ON "LibraryRoot"("path");

ALTER TABLE "Media" ADD COLUMN "root_id" INTEGER;

ALTER TABLE "Media" ADD COLUMN "file_modified_at" DATETIME;
```

Apply it from `ensure_schema` the same way `group_path` is applied: run the file when `LibraryRoot` is missing. Existing media rows keep `root_id` null until that folder is imported again.

On ingest, upsert the chosen directory into `LibraryRoot` and set `root_id` on every inserted or updated file from that walk. Store `file_modified_at` from `std::fs::metadata(path).modified()`, as UTC `YYYY-MM-DD HH:MM:SS`. Set it on both insert and conflict. Do not overwrite `created_at` on conflict.

`list_media` returns `rootId` and `fileModifiedAt` on each record. Add both fields to `NormalizedMedia`.

### 2. Rescan a root, and remove a root from the library

Add `list_roots`, `rescan_root`, and `remove_root`.

`list_roots` returns each root's id, path, and media count.

`rescan_root` runs `ingest_directory` on that path. Then select media with that `root_id` whose `filepath` was not seen in the walk. Do not delete those rows. Return `imported`, `already_present`, `skipped`, and `missing`.

`remove_root` deletes `MediaTag` rows for that root's media, then those `Media` rows, then the `LibraryRoot` row, in one transaction. It does not delete files on disk.

Show the roots in `AppMenuModal`: path, count, Rescan, Remove from library. Remove confirms with the path and the count. After remove, if the selected tag no longer exists, set the tag back to `"all"`.

### 3. Watch those folders

Add the `notify` crate. After startup, and after each ingest, watch every `LibraryRoot.path` recursively. Debounce bursts to about half a second, then emit `library-root-changed` with the root id and path.

`App.tsx` listens and shows a line under the header: `{folder name} changed on disk.` with a Rescan button that calls `rescan_root`. Do not ingest automatically from the watch event.

Stop the watcher for a root inside `remove_root`'s success path, and restart watchers when the root list changes.

### 4. Mark rows whose file is gone

When building a `MediaRecord` in `load_media`, set `fileMissing` from `!Path::new(&filepath).exists()`. This is computed, not stored.

In `MediaCard`, a missing item gets a "File missing" badge on the preview instead of a broken image. The card still opens.

In `MediaModal`, the same state replaces the image or the player with the filename and the sentence "This file is no longer at the stored path."

### 5. Reveal the file, and copy the path

Add `tauri-plugin-opener` and grant `opener:allow-reveal-item-in-dir` in `src-tauri/capabilities/default.json`. Register the plugin in `src-tauri/src/lib.rs`.

```rust
app.opener().reveal_item_in_dir(path)?;
```

`reveal_media(media_id)` loads the stored path and reveals it. If the file is missing, return `File not found: {path}`.

In the modal, next to the existing filepath text, add Reveal and Copy path. Copy uses `navigator.clipboard.writeText(current.filepath)`. Reveal shows the command error under the buttons. Copy stays enabled when the file is missing. Reveal on a missing file shows the not-found error.

### 6. Sort and display by file time

`buildGalleryEntries` currently sorts by `createdAt`. Change that comparison to `fileModifiedAt`, and fall back to `createdAt` when `fileModifiedAt` is null. Oldest is the same field, ascending. Phase 3 adds the sort control. This step only changes which timestamp "newest" means, so the default grid follows file time as soon as this phase lands.

In the modal, under the filename, format `fileModifiedAt` in the local timezone. When it is null, show `createdAt` and the label `Imported`.

### 7. Accept HEIC and HEIF

In `infer_media_type`, treat `.heic` and `.heif` as `PHOTO`.

On insert of a HEIC or HEIF file, write a JPEG preview to `data/previews/{uuid}.jpg` by running `heif-convert` (the `libheif-examples` binary):

```rust
std::process::Command::new("heif-convert")
    .arg(&filepath)
    .arg(&preview_path)
    .status()
```

If the binary is missing or the convert fails, still insert the row and leave the preview absent. Do not fail the rest of the folder.

`withFileUrl` in `src/lib/media-api.ts` points `fileUrl` at the preview JPEG when it exists. `filepath` stays the original HEIC so Reveal opens the real file. A HEIC with no preview uses the "Preview unavailable" badge from the missing-file treatment, and the row remains.

Extend the ingest test with a `.heic` file that is counted as imported. Asserting a real decode is optional and only runs when `heif-convert` is on `PATH`.

### 8. Check phase 2

- Importing a folder creates a root that is still listed after restart.
- Rescan of a folder that gained a file reports that file as imported and does not duplicate rows or clear tags.
- A file deleted on disk stays in the grid with the missing badge. Rescan reports it as missing and does not delete the row.
- Remove from library drops only that root's rows. The files are still on disk.
- Changing a file in a watched folder shows the changed line, and Rescan picks up the new file time.
- Reveal opens the file manager with that file selected. Copy path puts the absolute path on the clipboard.
- A `.heic` file becomes a library row. With `heif-convert` installed it shows the JPEG preview. Without it, the row shows Preview unavailable and the rest of the folder still imports.
- Two files imported together sort by file modified time, not by insert order.

Stop here and commit.

## Phase 3 — Finding things stops at one tag

The sidebar is a single tag. `App.tsx` keeps a whole carousel when any item in it has the tag. Group cards drop descriptions, and two folders with the same leaf name share one title.

### 1. Filter items, then group them

Build one item list, then pass it to `buildGalleryEntries`. Do not filter the entries afterward.

```tsx
const visibleMedia = useMemo(() => {
  return media.filter((item) => {
    if (selectedTag !== "all" && !item.tags?.some((tag) => tag.name === selectedTag)) {
      return false;
    }
    if (mediaType === "PHOTO" || mediaType === "VIDEO") {
      if (item.mediatype !== mediaType) return false;
    }
    if (query && !itemMatchesQuery(item, query)) return false;
    return true;
  });
}, [media, selectedTag, mediaType, query]);
```

`itemMatchesQuery` lowercases the query and tests `filename`, `description`, each tag name, and `folderName(groupPath)`.

Delete the `.some` filter that currently wraps `buildGalleryEntries`. A folder with one tagged clip then opens a carousel of that one clip. Sidebar counts stay as item counts, computed from the unfiltered `media` array.

When `visibleMedia` is empty and `media` is not, show `No matches` under the header and an empty grid. Phase 7 replaces this line.

### 2. Add the search box and the type control

In the header, add a search input labeled for screen readers. Placeholder: `Search files, tags, descriptions`.

Add a type control with three values: All, Photos, Videos. Default All.

Escape, while the search input is focused and the query is non-empty, clears the query. It must not close a modal. The modal is not open during a grid search.

`visibleCount` is the number of items in `visibleMedia`, not the number of cards.

### 3. Add sort

`buildGalleryEntries` takes a sort argument:

```ts
export type GallerySort = "newest" | "oldest" | "name-asc" | "name-desc";
```

| Sort | Comparison |
| --- | --- |
| `newest` | `fileModifiedAt`, then `createdAt`, descending. This is the phase 2 field. |
| `oldest` | The same fields, ascending. |
| `name-asc` | `title`, then the first item id |
| `name-desc` | `title` descending, then the first item id |

Default remains `newest`. Put the control in the header next to search. On a narrow window the controls wrap. They do not cover Add folder.

### 4. Distinguish folder titles, and show group descriptions

In `buildGalleryEntries`, the title is `folderName(groupPath)`. If two entries in the result share that title, set both titles to `leaf (parent)`, using the parent of `groupPath`.

`MediaCard` currently sets the description to `""` when `grouped && items.length > 1`. Replace that:

- Every item shares one non-empty description: show it, clamped as today.
- Descriptions differ: show the first non-empty one and the suffix `and N more`, where N is the number of other non-empty descriptions.
- None are set: show no description line.

Do not add a group description column.

### 5. Check phase 3

- A filename, a description fragment, a tag, and a subfolder name each narrow the grid.
- Search, the selected tag, and the photo or video control all apply together.
- A folder with one tagged clip and several untagged clips shows only the tagged clip while that tag is selected. All media still shows the full folder.
- Two imported subfolders both named `rally` show different card titles.
- A group with one shared description shows it. A group with mixed descriptions shows one line plus `and N more`.
- Newest and oldest follow file time for rows that have it, and import time for rows that do not.
- A query that matches nothing shows `No matches` and does not show the Add folder card.

Stop here and commit.

## Phase 4 — Tagging is one item at a time, then the viewer closes

Save writes one item and then closes the viewer. The tag field does not offer existing tags. Unused tags stay in the sidebar. There is no way to rename, merge, delete, or apply a tag to a folder.

### 1. Save without closing, and keep a dirty draft

In `MediaModal`, `saveTags` calls `onClose()` after success. Remove that call.

A draft is dirty when the tag set or the description differs from `current`. Compare tags as a sorted lowercase set. Compare the description to `(current.description ?? "").trim()`, which is what `update_description` stores.

Before `step()`, Cancel, the dialog close, and Escape: if the draft is dirty, confirm discard. Confirming continues. Dismissing the confirm stays on the clip with the draft. A clean form closes and moves with no prompt. While the confirm is open, the previous and next buttons stay disabled, same as `confirmingDelete`.

`handleSaveMetadata` must rethrow after it logs, so the modal can catch a failure. On failure, show the message under the buttons and keep the draft. On success, the parent replaces that item, the form effect reloads it, and the dirty flag clears. The button label returns to `Save`.

### 2. Suggest existing tags

Pass the library `tags` array into `MediaModal`. Under the input, list up to eight tags whose names contain the current input and that are not already in the draft. Clicking one appends it and clears the input.

The suggestion row is absent when the input is empty or nothing matches.

### 3. Drop tags that nothing uses

At the end of the `update_tags` transaction, and at the end of the `delete_media` transaction:

```sql
DELETE FROM Tag
WHERE id NOT IN (SELECT tagId FROM MediaTag);
```

`delete_all_media` already deletes every tag. Leave it.

### 4. Rename, merge, and delete a tag

Add `rename_tag(tag_id, new_name)` and `delete_tag(tag_id)`. Both return the library payload.

`rename_tag` trims and lowercases `new_name`. An empty name is an error. If another tag already has that name, repoint this tag's `MediaTag` rows at the existing tag, skip pairs that would duplicate the primary key, and delete the old tag. Otherwise `UPDATE Tag SET name = ?1 WHERE id = ?2`.

`delete_tag` deletes that tag's `MediaTag` rows, then the `Tag` row. Media rows stay.

Register both commands and wrap them in `media-api.ts`.

In `AppMenuModal`, list each tag with Rename and Delete. Rename is an inline field on that row. Delete confirms with the tag name and the number of items that will lose it. If the sidebar had that tag selected and the name is gone, `App.tsx` sets the selection back to `"all"`.

### 5. Apply the draft tags to the whole folder

When `items.length > 1` and every item shares `groupPath`, show `Apply tags to all {N} in this folder`.

The action adds the draft tag names onto each item. It does not remove tags that other items already have. Say that in the control: `Adds these tags. Tags already on a clip stay.`

Call `updateTags` once per item, in order. Refresh each returned item in `media` state. On the first failure, stop and show that filename. Items already saved stay saved.

Do not copy descriptions. After the tag writes succeed, tag dirtiness clears. An unsaved description still warns on close.

### 6. Check phase 4

- Save keeps the viewer open, and the tags and description are still there after restart.
- A failed save shows the error and keeps the typed text.
- Arrow, Cancel, and Escape on a dirty form ask first. A clean form does not.
- The tag field suggests an existing tag and does not create a duplicate chip.
- Removing the last use of a tag drops it from the sidebar after save.
- Renaming a tag updates every item that had it. Renaming onto an existing name leaves one sidebar row.
- Deleting a tag removes it from items and from the sidebar. The files remain.
- Apply-to-folder on a three-clip group adds the draft tags to all three and keeps tags that only one clip had. A single loose file does not show the control.

Stop here and commit.

## Phase 5 — Playback is aimed at portrait phone clips

The viewer frame is hardcoded to 9:16 in `videoContainerStyle`. `src/lib/media-ratio.ts` is unused. Photos do not zoom. The carousel has previous, next, and a `3 / 12` label. Video.js seeks by 0.1 seconds, and `handlePlayerReady` logs to the console.

### 1. Size the frame from the clip

When a gallery video draws a poster, call `rememberMediaRatio(src, videoWidth, videoHeight)`. Call it again from the modal player on `loadedmetadata`. For a photo, call it from the image `onLoad` with `naturalWidth` and `naturalHeight`.

In the modal, read `lookupMediaRatio(fileUrl)`. If a ratio `r` (width / height) exists, set the frame so the height is at most `min(90vh, calc(100vh - 6.75rem))` and the width is at most the space left of the 320px side panel. Derive the other side from `r`.

If no ratio is known yet, use 16:9, then replace the box when metadata arrives. Do not default to 9:16.

Switching carousel items recomputes the box for that item. Gallery cards stay `object-cover` inside the 4:3 tile.

### 2. Add the filmstrip

Under the frame, when `items.length > 1`, render one button per item.

Photos use `fileUrl`. Videos use a muted preview. The active button uses the ball ring. Clicking a button goes through the same dirty check as `step()` from phase 4.

Keep the previous and next buttons and the `index + 1 / length` text. When the index changes from the keyboard, scroll the active thumbnail into view.

Each button's accessible name is `{filename}, {position} of {length}`.

A single file renders no strip.

### 3. Zoom and pan photos

For `mediatype === "PHOTO"`, add Zoom in, Zoom out, and Fit, placed over the image and not in the tag form.

```tsx
const [scale, setScale] = useState(1);
const [pan, setPan] = useState({ x: 0, y: 0 });
```

Clamp `scale` from 1 to 4. Zoom in multiplies by 1.25. Zoom out divides. Fit sets `scale` to 1 and `pan` to `{ x: 0, y: 0 }`.

When `scale > 1`, pointer drag updates `pan`. Ignore drags that start on the carousel buttons or the filmstrip. Double-click toggles between 1 and 2. Changing `index` resets scale and pan.

Wheel over the image changes scale and does not scroll the side panel. `+` and `-` zoom when the event target is not an input, a textarea, or a contenteditable. A hyphen typed into the tag field must not zoom.

Videos do not render these controls.

### 4. Slow the clip, loop it, and step a quarter second

In `VideoJS.tsx`, change `seekStep` from `0.1` to `0.25`.

Delete the `console.log` calls in `handlePlayerReady`. The `onReady` prop can stay as a no-op.

Add a speed control with `0.25`, `0.5`, `1`, and `1.5`. Apply it with `player.playbackRate(rate)` once the player is ready and whenever the choice changes. Add a loop toggle that sets `player.loop(on)`. Both default off of slow motion: rate `1`, loop `false`.

Reset both when `current.id` changes. Show the controls only for video, in the side panel above the filepath. Do not cover the controls Video.js already draws.

### 5. Check phase 5

- A landscape clip plays in a landscape frame. A portrait clip plays in a portrait frame. The first open corrects the frame when metadata loads.
- A group shows a filmstrip. Clicking the last thumbnail jumps there. A dirty form still asks first. A single file has no strip.
- A photo zooms, pans, and returns to fit. The next photo opens at fit. Videos have no zoom controls. Typing `-` in the tag field does not zoom.
- Arrow seek inside the player moves about a quarter second. `0.25×` and loop apply to the current clip only. The next clip starts at `1×` and not looping.
- Ordinary play and close do not log `player is waiting` or `player will dispose`.

Stop here and commit.

## Phase 6 — Delete is the whole settings menu

Ctrl+, opens `AppMenuModal`, titled `pickleball-media-organizer`, whose only action besides Close is Delete all. The shortcut is printed inside the dialog the shortcut just opened. A deleted row is gone for the session.

Phase 2 put roots in this dialog. Phase 4 put the tag list in it. Keep both. This phase changes the dialog around them.

### 1. Retitle the dialog and list the shortcuts that exist

Set the title to `Settings`. Keep one sentence of description about organizing local photos and videos.

List the shortcuts that have handlers:

| Shortcut | Action |
| --- | --- |
| Ctrl+, or Cmd+, | Settings. Already implemented. |
| Ctrl+O or Cmd+O | Add folder. Add this listener in `App.tsx`. |

Do not document a shortcut that has no listener. Remove the line that only says `Shortcut: Ctrl + ,`.

The native menu item can keep a short label. The dialog title is `Settings`.

Move Delete all to the bottom of the dialog. The existing confirm stays.

### 2. Undo one delete

Add `restore_media` that inserts one media row and its tag names, then returns the library.

```rust
pub struct DeletedMedia {
    pub uuid: String,
    pub filename: String,
    pub filepath: String,
    pub mediatype: String,
    pub description: Option<String>,
    pub group_path: Option<String>,
    pub root_id: Option<i64>,
    pub file_modified_at: Option<String>,
    pub created_at: String,
    pub tags: Vec<String>,
}
```

`delete_media` should return that payload along with the library, or the webview can snapshot the item before calling delete. Prefer returning it from Rust so the snapshot matches the row that was removed.

Insert with the original filepath. The unique index rejects a restore if that path was imported again. Surface that error on the undo line.

In `App.tsx`, after a successful single-item delete, show `Removed {filename}.` and an Undo button in the header. Undo calls `restore_media` and clears the line. A second single delete replaces the undo payload. Delete all clears it and does not offer undo. Restarting the app clears it. Do not write an undo table.

### 3. Check phase 6

- The menu bar and Ctrl+, open a dialog titled Settings.
- Roots and tags from the earlier phases are still in that dialog. Delete all is last and still confirms.
- Ctrl+O opens the folder dialog.
- Deleting one clip shows Undo. Undo puts the clip back with its tags, description, group, and root.
- Undo disappears after a second delete, after Delete all, and after restart.
- Delete all has no undo.

Stop here and commit.

## Phase 7 — The empty state lies when a filter matches nothing

`App.tsx` renders the Add folder card whenever `gallery.length === 0`. That card is correct only when `media.length === 0`. The header always says `Highlights` and `Library`.

Phase 3 left a `No matches` line for an empty filter. This phase replaces it.

### 1. Split the two empty grids

Inside the grid section, branch in this order:

1. `isLoading`: keep the current loading row.
2. `loadError` and `media.length === 0`: show the error, not the Add folder card.
3. `media.length === 0`: keep the dashed card, the ball mark, and Add folder.
4. `gallery.length === 0`: the library has rows and the current search, tag, or type matches none. Show a dashed card that names the active tag or the query, says nothing matches, and offers `Show all media`. That button clears the query, sets the type to All, and sets the tag to `"all"`. Do not put Add folder on this card.

Delete the `No matches` line from phase 3.

### 2. Name the view in the header

Replace the fixed `Highlights` label:

```tsx
const viewLabel =
  selectedTag === "all" ? "All media" : selectedTag;
```

When a query is set, append it: `{viewLabel} · “{query}”`. Keep `visibleCount` as the subtitle when there is no load error.

### 3. Check phase 7

- A new library still shows the Add folder card.
- A tag, a search, or a type that matches nothing shows the filter card and does not invite another import.
- Show all media clears the tag, the query, and the type.
- The header names the tag and the query.
- A load error on an empty library stays an error.

Stop here and commit.

## Phase 8 — The grid is mouse-only

`MediaCard` is a clickable `div`. The title uses `break-all`. Every sidebar tag uses the `Images` icon. Untagged cards say `No tags`.

### 1. Make the card a button

`MediaCard` has no inner buttons. Render the `Card` as a `button`, or put `role="button"` on it only if `Card` cannot forward the element. A `button` with `type="button"`, `text-left`, and `w-full` is the change to make.

```tsx
<Card
  asChild
>
  <button type="button" className="w-full text-left" onClick={onSelect}>
    {/* existing card body */}
  </button>
</Card>
```

Use whichever pattern `src/components/ui/card.tsx` already supports. If `asChild` is not on `Card`, set `role="button"` and `tabIndex={0}` on the current element and handle Enter and Space in `onKeyDown`.

Add `focus-visible:ring-2 focus-visible:ring-ball`. Keep the hover ring.

Keep `data-testid="gallery-card"` and `data-testid="gallery-card-title"`.

### 2. Wrap filenames on word boundaries

On the title, replace `break-all` with `break-words line-clamp-2`, and set `title={title}` so the full string is still available.

### 3. Stop announcing empty tags, and use one tag icon

Delete the `No tags` span in `MediaCard`. An empty `tagNames` list renders no tag row.

In `Sidebar.tsx`, replace the `Images` icon on each tag with the lucide `Tag` icon. All media keeps `Library`.

### 4. Check phase 8

- Tab reaches each card. Enter and Space open it. A ring shows which card is focused.
- A long filename wraps at word boundaries and clamps to two lines. Hover and click still open the viewer.
- Untagged cards do not say `No tags`. Tagged cards still show badges.
- Sidebar tags use the tag icon.

Stop here and commit.

## Phase 9 — The viewer is dense in the wrong places

The side panel leads with the absolute path. The title is sliced at 80 characters. Delete sits in the same footer as Save. Poster frames live in a module-level `Map` in `MediaCard.tsx` that never evicts.

The filmstrip from phase 5 is the thumbnail row. Do not add a second one. Reveal and Copy path from phase 2 stay. This phase only moves them.

### 1. Put the path behind the actions

The title shows the full filename with `line-clamp-2` and `title={current.filename}`. Delete the `slice(0, 80)` truncation.

Order the side panel as: description, tags, then Reveal and Copy path, then the filepath in `text-xs` under those buttons. The filepath is not the first block.

### 2. Separate Delete from Save

Move the Delete button out of the Save / Cancel row. Place it at the bottom of the side panel as a destructive text button, with the confirm dialog unchanged. Save and Cancel stay the primary pair.

### 3. Cap the poster cache

`posters` is a `Map<string, string>` of data URLs. Cap it at 80 entries. `Map` keeps insertion order.

When storing a poster and `posters.size > 80`, delete `posters.keys().next().value`. On a cache hit, delete the key and set it again so the entry becomes the newest.

If two cards share a `src`, they share one entry. Do not decode again while the entry exists.

In the video effect, set a `cancelled` flag in the cleanup. `rememberFrame` and `setPoster` return immediately when `cancelled` is true.

Leave the intersection observer and the `240px` root margin as they are.

### 4. Check phase 9

- The filename in the viewer is the full name, clamped, and is not cut at 80 characters.
- Reveal and Copy path sit above the raw path. The path is still readable.
- Delete is not in the Save / Cancel cluster. Confirm still appears, and the file stays on disk.
- After scrolling a grid of more than 80 videos, the poster map holds at most 80 entries.
- Returning to a recently shown card uses the cached image.
- Leaving a card while its video is seeking does not update an unmounted component.

Stop here and commit.

## Phase 10 — The shell does not adapt

`src-tauri/tauri.conf.json` opens at 1920×1400 with no minimum. The sidebar is a fixed `w-64`. Section labels use `text-court-foreground/50`, and the empty tag line uses `/45`. `tailwind.config.cjs` sets `darkMode: ["class"]`, and `src/index.css` has no `.dark` variables. Outfit is loaded from Google Fonts, which is why the CSP allows `fonts.googleapis.com` and `fonts.gstatic.com`.

### 1. Set a laptop-sized window

In `src-tauri/tauri.conf.json`, set the main window to:

```json
"width": 1280,
"height": 800,
"minWidth": 960,
"minHeight": 640
```

Leave `resizable` true.

### 2. Let the sidebar collapse

Add a header button that toggles the sidebar. Collapsed, the `aside` is not rendered and the grid uses the full width. Persist `"sidebar-collapsed"` in `localStorage`. Default is expanded. Read the stored value in `useState` so the first paint matches.

### 3. Raise the quiet sidebar text

In `Sidebar.tsx`, change `text-court-foreground/50` and `text-court-foreground/45` to `text-court-foreground/70` on the Browse label, the Tags label, and the empty "No tags yet" line.

### 4. Honor reduced motion

In `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .group:hover {
    transform: none;
  }
}
```

Also stop the card image `group-hover:scale-[1.02]` under that query, and set dialog enter/exit animations to `none`. A utility override is enough. Do not remove the hover ring.

### 5. Self-host Outfit

Put the woff2 files for weights 400, 500, 600, and 700 in `src/assets/fonts/`. Declare them with `@font-face` in `src/index.css`, using those weights and `font-display: swap`. Delete the Google Fonts `@import`.

Remove `https://fonts.googleapis.com` from `style-src` and `https://fonts.gstatic.com` from `font-src` in the CSP in `tauri.conf.json`.

### 6. Add a dark theme

Add a `.dark` block in `src/index.css` that redefines the same variables `:root` already sets: background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, court, ball, and radius. The court sidebar stays the dark green brand. The main pane uses a dark background and light foreground.

In Settings, add Light, Dark, and System. System follows `prefers-color-scheme`. Store the choice in `localStorage` under `"theme"`. Toggle the class on `document.documentElement`.

Apply the saved class in `index.html` before the module script, so the first paint does not flash the wrong theme:

```html
<script>
  (function () {
    var theme = localStorage.getItem("theme") || "system";
    var dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  })();
</script>
```

`"theme"` missing means system.

### 7. Check phase 10

- A fresh launch opens at 1280×800 and cannot be resized below 960×640.
- The sidebar hides, and it stays hidden after restart.
- Browse, Tags, and "No tags yet" are readable on the court background.
- With reduced motion requested, cards do not lift or scale on hover. The focus and hover rings remain.
- Outfit still loads with the network blocked.
- Light, Dark, and System each stick across a restart, and the first paint matches the saved choice.

Stop here and commit.

## Suggested commit split

1. `feat: report import counts, progress, and errors`
2. `feat: track library folders, missing files, and file time`
3. `feat: search, sort, and filter the gallery`
4. `feat: edit tags without closing the viewer`
5. `feat: fit playback to the clip and review a point`
6. `feat: turn the app menu into settings and undo delete`
7. `feat: separate the empty library from an empty filter`
8. `feat: make gallery cards keyboard accessible`
9. `feat: simplify the viewer and cap poster cache`
10. `feat: adapt the window, type, motion, and theme`

Run the phase checklist before each commit.
