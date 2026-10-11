# Improvement plan

Work through this list in order. Finish one improvement, including its checks, before starting the next. Each improvement is scoped so it can land on its own.

How to use this file:

1. Pick the first improvement whose status is still open.
2. Do the steps in the order written. Do not pull work from a later improvement into the current one.
3. When the "Done when" checks all pass, change that improvement's status to `done` in this file.
4. Stop. The next session starts at the next open improvement.

Status values: `open`, `in progress`, `done`.

The app today is a local library. Add Folder walks a directory, groups files under each immediate subfolder into one carousel, leaves root files as single cards, and stores tags and descriptions in SQLite. Deleting an item removes the database row and leaves the file on disk.

## Order

| # | Improvement | Status |
| --- | --- | --- |
| 1 | Show what an import did, and show when it failed | open |
| 2 | Tell an empty library apart from an empty filter | open |
| 3 | Make gallery cards keyboard accessible and readable | open |
| 4 | Search the library | open |
| 5 | Sort the grid and filter by photo or video | open |
| 6 | Make a tag filter show only the matching items | open |
| 7 | Give grouped cards a description and a distinct title | open |
| 8 | Quiet untagged cards and stop using one icon for every tag | open |
| 9 | Save without closing, and do not drop unsaved edits | open |
| 10 | Suggest, rename, merge, delete, and prune tags | open |
| 11 | Apply tags to a whole group | open |
| 12 | Size the video player to the clip | open |
| 13 | Add a filmstrip to the carousel | open |
| 14 | Zoom and pan photos | open |
| 15 | Make playback useful for reviewing a point | open |
| 16 | Reveal a file, copy its path, and mark missing files | open |
| 17 | Rescan a folder and remove one source folder | open |
| 18 | Use file time instead of import time | open |
| 19 | Accept phone photos and drop a folder on the window | open |
| 20 | Replace the app menu with settings, and undo a delete | open |
| 21 | Stop holding every poster frame in memory | open |
| 22 | Fit the window, and fix contrast, motion, fonts, and dark mode | open |

---

## 1. Show what an import did, and show when it failed

**Status:** open

**Goal:** After Add Folder, the user sees how many files were added, how many were already in the library, and how many were skipped. A failed import is visible in the window. The empty-state button cannot start a second import.

**Why:** `ingest_folder` already returns `imported` and `skipped` (`src/lib/media-api.ts`, `src-tauri/src/commands.rs`). `handleAddFolder` in `src/App.tsx` ignores both counts. A path that already exists still increments `imported` in `ingest_directory` (`src-tauri/src/db.rs`) because `ON CONFLICT(filepath) DO UPDATE` still counts as a successful statement. Errors are only `console.error`. The header button is disabled while `isAdding` is true; the empty-state button is not.

**Touches:** `src/App.tsx`, `src-tauri/src/db.rs`, and the ingest test in that file.

**Steps:**

1. In `ingest_directory`, split the counter into three numbers: newly inserted, already present, and skipped. Use SQLite `changes()` after each `INSERT`. A conflict that only refreshes `group_path` counts as already present, not as a new import. Keep the existing rule that a conflict does not wipe tags or description.
2. Extend `IngestPayload` and `AddFolderResponse` with the new count. Keep `imported` as the newly inserted count so the name stays honest.
3. Update the ingest unit test. Re-importing the fixture folder must report the files as already present, and the kept description on `a1.png` must still be there.
4. In `handleAddFolder`, if the dialog was cancelled (`imported`, `skipped`, and already-present are all zero and `media` is missing), return without a message.
5. On success, show a short confirmation near the header count, for example "Added 12, 4 already in the library, skipped 3." Clear it when the next import starts. Do not use a toast library in this step.
6. On failure, set a visible error string in the same place as `loadError`. Leave the current library on screen.
7. Pass `disabled={isAdding}` to the empty-state Add folder button, and give it the same Importing label the header button uses.

**Done when:**

- A new folder reports only the files that were actually inserted.
- Importing that folder again does not increase the new-file count and does not clear tags or descriptions.
- Cancelling the folder dialog shows no message.
- A failed import shows the error in the header and does not wipe the grid.
- Both Add folder buttons are disabled while an import is running.

---

## 2. Tell an empty library apart from an empty filter

**Status:** open

**Goal:** An empty library invites the user to add a folder. A tag that matches nothing says so, names the tag, and offers a way back to All media. The header names what is being shown.

**Why:** `src/App.tsx` uses one empty state whenever `gallery.length === 0`. That is wrong when `media.length > 0` and `selectedTag !== "all"`. The header always says "Highlights" and "Library".

**Touches:** `src/App.tsx`. Sidebar selection already exists; do not redesign the sidebar here.

**Steps:**

1. Branch the empty grid on three cases: still loading, library has no rows, and library has rows but the current selection matches nothing.
2. Keep the current dashed card and Add folder button only for the truly empty library.
3. For a filtered empty grid, name the selected tag, say nothing matches it, and add a button that calls `onSelectTag("all")`. Do not offer Add folder as the primary action.
4. In the header, replace the fixed "Highlights" label with the current view: "All media", or the selected tag name. Keep the file count as the number of visible files, which `visibleCount` already is.
5. When `loadError` is set, keep the error as the subtitle and do not also show the empty-library card as if the library were empty.

**Done when:**

- A new library still shows the Add folder empty state.
- Selecting a tag with no matches shows the filter empty state and does not invite another import.
- Clearing that state returns to All media.
- The header text changes with the selected tag.
- A load error stays visible and is not replaced by "No highlights yet".

---

## 3. Make gallery cards keyboard accessible and readable

**Status:** open

**Goal:** Cards open from the keyboard, show a focus ring, and long filenames wrap on word boundaries.

**Why:** `MediaCard` is a clickable `div` (`src/components/MediaCard.tsx`). It is not in the tab order. The title uses `break-all`, so names split mid-word.

**Touches:** `src/components/MediaCard.tsx`.

**Steps:**

1. Make the card a `button` or give it `role="button"`, `tabIndex={0}`, and an `onKeyDown` that calls `onSelect` for Enter and Space. Prefer a single `button` only if it does not wrap other buttons. The card has no inner buttons today, so a `button` with `text-left` and `w-full` is the smaller change.
2. Add `focus-visible:ring-2 focus-visible:ring-ball` so keyboard focus matches the hover ring. Keep the hover lift.
3. Replace `break-all` on the title with `break-words` and `line-clamp-2`. Set `title={title}` so the full name is still available.
4. Confirm the card still exposes `data-testid="gallery-card"` and `data-testid="gallery-card-title"`.

**Done when:**

- Tab reaches each card, Enter and Space open it, and a visible ring shows which card is focused.
- A long filename wraps at word boundaries and clamps to two lines.
- Hover and click behavior are unchanged.

---

## 4. Search the library

**Status:** open

**Goal:** A search box narrows the grid by filename, description, folder name, and tag name.

**Why:** The only narrowing control is a single tag in the sidebar. Descriptions and filenames are invisible to that filter.

**Touches:** `src/App.tsx`, and a small helper if the match logic should not live in the component. Filtering belongs on `NormalizedMedia` items before `buildGalleryEntries`, so a group does not keep files that failed the query. Do this item-level filter here; tag-filter behavior is improvement 6.

**Steps:**

1. Add a search input in the header, with a label that screen readers can see. Placeholder: "Search files, tags, descriptions".
2. Match case-insensitively against `filename`, `description`, each tag `name`, and the last path segment of `groupPath` (use `folderName` from `src/lib/gallery.ts`). An empty query matches everything.
3. Apply search before grouping. Build gallery entries from the matching items only.
4. Combine search with the current tag selection using AND. Both narrow the same item list.
5. When the query matches nothing and the library is not empty, reuse the filtered empty state from improvement 2. Name the query. Clearing the input restores the previous grid.
6. Escape, while the input is focused and non-empty, clears the query and does not close a modal. A modal is not open during a normal grid search.

**Done when:**

- Typing a filename, a description fragment, a tag, or a subfolder name shows only the matching cards.
- Search and the selected tag both apply.
- Clearing the box restores the unfiltered view for that tag.
- The empty result is the filter empty state, not the "add a folder" card.

---

## 5. Sort the grid and filter by photo or video

**Status:** open

**Goal:** The user can order the grid and can limit it to photos or videos.

**Why:** `buildGalleryEntries` always sorts by newest `createdAt`. There is no media-type control. `createdAt` is still the import time until improvement 18; this step only changes the control, not the meaning of the timestamp.

**Touches:** `src/App.tsx`, `src/lib/gallery.ts`.

**Steps:**

1. Add a sort choice with four options: newest, oldest, name A–Z, name Z–A. Default stays newest.
2. Pass the choice into `buildGalleryEntries` (or sort the returned entries in the caller). Newest and oldest compare the max `createdAt` already used in `gallery.ts`. Name sorts use `title`, with `id` as a tie-break.
3. Add a media-type choice: All, Photos, Videos. Filter items by `mediatype` before grouping, alongside search and the selected tag.
4. Place both controls in the header, on one row with search. On a narrow window they wrap; they do not cover the Add folder button.
5. The visible count and the filter empty state follow the combined filters. Sort does not change the count.

**Done when:**

- Each sort order is stable and obvious on a library with at least two groups and two loose files.
- Photos hides videos, Videos hides photos, All shows both.
- Search, tag, type, and sort all apply together.
- Refreshing the library does not need to persist these choices yet.

---

## 6. Make a tag filter show only the matching items

**Status:** open

**Goal:** Choosing a tag opens carousels that contain only items with that tag.

**Why:** `src/App.tsx` keeps a gallery entry when `entry.items.some(...)` matches the tag. A folder of ten clips appears in full when one clip has the tag.

**Touches:** `src/App.tsx`. Depends on the item-level filtering introduced in improvements 4 and 5. If those are done, this is mostly deleting the entry-level `.some` filter.

**Steps:**

1. Remove the filter that runs on `buildGalleryEntries` output.
2. Before calling `buildGalleryEntries`, drop items that do not have the selected tag. `"all"` skips this drop.
3. Leave grouping in place, so several matches from the same subfolder still form one carousel. A single match becomes a one-item group and still shows the folder title and the group count badge.
4. Sidebar counts stay as they are: number of items carrying the tag, not number of cards.
5. The header visible count matches the number of matching files, not the size of the original folders.

**Done when:**

- A folder with one tagged clip and several untagged clips shows only the tagged clip while that tag is selected.
- All media still shows the full folder.
- Sidebar counts do not change just because the grid is filtered.

---

## 7. Give grouped cards a description and a distinct title

**Status:** open

**Goal:** A grouped card shows description text when its items have one. Two folders with the same leaf name are distinguishable.

**Why:** `MediaCard` sets `rawDescription` to `""` when `grouped && items.length > 1`. `folderName` in `src/lib/gallery.ts` keeps only the last path segment, so `match-1/rally` and `match-2/rally` both render as "rally".

**Touches:** `src/lib/gallery.ts`, `src/components/MediaCard.tsx`.

**Steps:**

1. When building a grouped entry, set the title to the leaf folder name. If another entry in the same result already uses that title, append the parent folder name in parentheses for every colliding entry, including the first one.
2. On the card, if every item shares one non-empty description, show that description with the existing clamp.
3. If descriptions differ, show the first non-empty description and a suffix such as "and N more" where N is the number of other non-empty descriptions. If none are set, show no description line.
4. Do not invent a group-level description field in the database in this step.

**Done when:**

- Two imported subfolders named `rally` under different parents show different card titles.
- A group whose clips share a description shows it.
- A group with mixed descriptions shows one of them plus a count of the rest.
- Single-file cards still show their own description, clamped as they are today.

---

## 8. Quiet untagged cards and stop using one icon for every tag

**Status:** open

**Goal:** Cards with no tags do not say "No tags". Sidebar tags use a tag icon rather than an image icon.

**Why:** `MediaCard` renders "No tags" on every untagged card. `Sidebar` uses the `Images` icon for every tag, including tags that are mostly video.

**Touches:** `src/components/MediaCard.tsx`, `src/components/Sidebar.tsx`.

**Steps:**

1. Remove the "No tags" line. Leave the tag row empty when `tagNames` is empty so the card footer does not imply missing work.
2. In the sidebar, replace `Images` with the lucide `Tag` icon for each tag row. Leave the Library icon on All media.
3. Keep the tag counts and the selected-state colors.

**Done when:**

- Untagged cards show the title and preview without a "No tags" caption.
- Tagged cards still show their badges.
- Every sidebar tag uses the tag icon, and All media still uses the library icon.

---

## 9. Save without closing, and do not drop unsaved edits

**Status:** open

**Goal:** Save writes the current clip and leaves the viewer open. Leaving the clip or closing the viewer asks before discarding edits. A failed save is shown and the draft stays put.

**Why:** `saveTags` in `src/components/MediaModal.tsx` calls `onClose()` after a successful `onSave`. Arrow keys, the carousel buttons, Cancel, and Escape all drop the draft with no check. `handleSaveMetadata` in `src/App.tsx` only logs failures, and the modal has no error text. The effect that resets the form when `current` changes will wipe a draft as soon as the index changes, so the guard has to run before `setIndex`.

**Touches:** `src/components/MediaModal.tsx`, `src/App.tsx`.

**Steps:**

1. Track a dirty flag: the draft tag list or description differs from `current`. Compare tags as a sorted lowercase set. Compare description to `current.description ?? ""` after trim, matching what `update_description` stores.
2. Remove `onClose()` from the success path. Button label returns to "Save" and stays disabled while a save is in flight. After a successful save, the dirty flag clears because the parent replaces that item and the form effect reloads it.
3. Show a one-line error under the buttons when `onSave` throws. Clear it on the next edit.
4. In `handleSaveMetadata`, rethrow after logging so the modal can catch it. Do not clear the draft.
5. Before `step()`, Cancel, the dialog close, and Escape: if the draft is dirty, confirm discard. Confirming proceeds with the navigation or close. Cancelling stays on the clip with the draft intact.
6. Do not prompt when nothing changed.
7. Disable the previous/next buttons while the confirm is open, same as delete confirm already does for `confirmingDelete`.

**Done when:**

- Save keeps the viewer open on the same clip, and reopening it shows the saved tags and description.
- A failed save shows the error and keeps the typed text.
- Arrow, Cancel, and Escape on a dirty form ask first.
- A clean form still closes and still moves between clips with no prompt.

---

## 10. Suggest, rename, merge, delete, and prune tags

**Status:** open

**Goal:** The tag field offers existing tags. A tag can be renamed, merged into another, or deleted everywhere. Tags that no item uses disappear from the sidebar.

**Why:** The modal input never reads the `tags` list. `update_tags` inserts rows and does not delete unused `Tag` rows. `delete_media` deletes join rows and the media row, not orphan tags. There is no rename or delete-tag command. `list_tags` exists on the backend and is unused by the UI.

**Touches:** `src/components/MediaModal.tsx`, `src/App.tsx`, `src/lib/media-api.ts`, `src-tauri/src/commands.rs`, `src-tauri/src/db.rs`, `src-tauri/src/lib.rs`.

**Steps:**

1. Pass the library tag list into `MediaModal`. Under the input, show tags that are not already on this clip and whose name contains the current input. Clicking one adds it to the draft. Limit the list to eight suggestions.
2. After `update_tags` and after `delete_media`, delete `Tag` rows that have no `MediaTag` rows. Do this in the same transaction. `delete_all_media` already removes tags; leave that path alone.
3. Add `rename_tag(tag_id, new_name)`. Trim and lowercase the new name, matching `update_tags`. If the new name is empty, return an error. If another tag already has that name, re-point this tag's `MediaTag` rows at the existing tag, skip pairs that would duplicate the composite key, and delete the old tag. That is the merge.
4. Add `delete_tag(tag_id)`. Delete its `MediaTag` rows, then the `Tag` row. Do not delete media.
5. Register both commands and wrap them in `media-api.ts`. Both return the refreshed library payload so the UI can replace `media` and `tags`.
6. Add a tag manager inside the app menu only as a list of buttons for now: each tag has Rename and Delete. Rename uses a prompt or a small inline field, not a new screen. Delete confirms with the tag name and the number of items that will lose it. Wire the menu in `AppMenuModal` without moving Delete all.
7. If the renamed or deleted tag was selected in the sidebar, fall back to All media when that name no longer exists.

**Done when:**

- Typing in the tag field suggests an existing tag and adds it without creating a duplicate chip.
- Removing the last use of a tag, then saving, drops that tag from the sidebar.
- Renaming a tag updates every item that had it.
- Renaming onto an existing name merges the two and leaves one sidebar row.
- Deleting a tag removes it from items and from the sidebar, and the files remain.

---

## 11. Apply tags to a whole group

**Status:** open

**Goal:** From a grouped viewer, the user can add the current draft tags onto every clip in that group.

**Why:** Tags are saved per `mediaId` only. A rally folder of many clips means repeating the same save.

**Touches:** `src/components/MediaModal.tsx`, `src/App.tsx`, `src/lib/media-api.ts`. Reuse `update_tags`. Do not add a new database table.

**Steps:**

1. Show an "Apply tags to all N in this folder" control only when `items.length > 1` and every item shares the same `groupPath`.
2. The action adds the current draft tag list onto each item. It does not remove tags that are only on other items. Describe this in the button's accessible name or a short line of help so it is not read as "replace".
3. Run the existing `updateTags` command once per item, in order. Then refresh each item in `media` state. If one call fails, stop, show which filename failed, and leave the ones that already saved as saved.
4. Do not copy descriptions in this action.
5. If the form is dirty, this action still persists tags for every item, then marks tags clean. Description dirtiness stays independent, so a later close still warns about an unsaved description.

**Done when:**

- Applying tags to a three-clip folder adds those tags to all three, including clips that already had other tags.
- Tags that were only on one clip are still there afterward.
- A failure midway names the file that failed and does not pretend the rest were skipped after a success.
- The control is absent for a single loose file.

---

## 12. Size the video player to the clip

**Status:** open

**Goal:** The viewer frame uses the clip's real width-to-height ratio. Portrait and landscape both fit the viewport without a hardcoded 9:16 box.

**Why:** `videoContainerStyle` in `src/components/MediaModal.tsx` is fixed at `9 / 16`. `src/lib/media-ratio.ts` stores ratios and is never imported.

**Touches:** `src/components/MediaModal.tsx`, `src/components/MediaCard.tsx`, `src/lib/media-ratio.ts`.

**Steps:**

1. When a gallery video preview decodes a frame, call `rememberMediaRatio(src, videoWidth, videoHeight)`. Do the same from the modal video once `loadedmetadata` fires. For a photo, remember the ratio from `naturalWidth` and `naturalHeight` on load.
2. In the modal, read `lookupMediaRatio(fileUrl)` for the current item. If a ratio exists, set the frame box from it: height capped by the viewport, width capped by the space left of the 320px side panel, and the other dimension derived from the ratio. Keep `object-contain` behavior by giving Video.js a box that already matches the video, so it does not letterbox inside a portrait frame.
3. If no ratio is known yet, use a neutral box (16:9) and update the box when the metadata arrives. Do not lock 9:16 as the default.
4. Switching carousel items must recompute the box for that item's source.
5. Leave the gallery card crop as `object-cover` in the 4:3 tile. This step is the viewer, not the grid thumbnails.

**Done when:**

- A landscape clip plays in a landscape frame.
- A portrait clip plays in a portrait frame.
- A clip opened for the first time corrects its frame once metadata loads, without a reload of the app.
- Photos still use the existing contain sizing.

---

## 13. Add a filmstrip to the carousel

**Status:** open

**Goal:** A grouped viewer shows one thumbnail per item. Clicking a thumbnail jumps to that item. Arrow keys still move by one.

**Why:** The modal only has previous, next, and a "3 / 12" label (`src/components/MediaModal.tsx`).

**Touches:** `src/components/MediaModal.tsx`, `src/components/MediaCard.tsx` only if the poster cache needs to be shared. Prefer reading posters that improvement 12's ratio path already decoded; a plain `<img>` or muted `<video>` thumbnail is enough for this step.

**Steps:**

1. Render a horizontal strip under the media, one button per item, only when `items.length > 1`.
2. Photos use `fileUrl`. Videos use a muted preview. If improvement 21 has not landed, a short-lived `<video>` or `<img>` in the strip is acceptable. Mark the active thumbnail with the ball ring.
3. Clicking a thumbnail sets the index. Run it through the same dirty-check as `step()` from improvement 9.
4. Keep the previous/next buttons and the position text.
5. The strip scrolls the active thumbnail into view when the index changes from the keyboard.
6. Give each thumbnail an accessible name that includes the filename and the position.

**Done when:**

- A group of several items shows a strip, and clicking the last item jumps there without stepping through the rest.
- A dirty form still asks before the jump.
- A single file shows no strip.
- Arrow keys still move one item at a time.

---

## 14. Zoom and pan photos

**Status:** open

**Goal:** A photo can be enlarged and dragged inside the viewer, then reset.

**Why:** Photos render as a single `<img>` with `object-contain` and no zoom.

**Touches:** `src/components/MediaModal.tsx`. Do not add a dependency.

**Steps:**

1. Add Zoom in, Zoom out, and Fit controls, visible only for `PHOTO`. Put them over the image, not in the tag form.
2. Track a scale starting at 1, clamped between 1 and 4. Zoom in multiplies by about 1.25. Zoom out divides. Fit sets scale to 1 and resets the pan offset.
3. When scale is above 1, pointer drag changes the pan offset. Ignore drag that starts on the carousel buttons.
4. Double-click toggles between 1 and 2.
5. Changing the carousel index resets scale and pan.
6. Wheel over the image adjusts scale. Do not let the wheel scroll the side panel while the pointer is over the image.
7. Keyboard + and - zoom when the focus is not in the description, tag input, or a button that needs those keys. `-` must not fire while typing a tag.

**Done when:**

- A photo zooms in, pans, and returns to fit.
- The next photo opens at fit, not at the previous photo's zoom.
- Videos do not show the zoom controls.
- Typing a hyphen in the tag field does not zoom.

---

## 15. Make playback useful for reviewing a point

**Status:** open

**Goal:** The user can slow the clip, loop it, and step about a quarter of a second. The player does not log to the console.

**Why:** `VideoJS` enables `videojs-hotkeys` with `seekStep: 0.1`. `handlePlayerReady` in `MediaModal` logs `waiting` and `dispose`. There is no speed or loop control in the UI.

**Touches:** `src/components/VideoJS.tsx`, `src/components/MediaModal.tsx`.

**Steps:**

1. Change the hotkey seek step from 0.1 seconds to 0.25 seconds.
2. Remove the `console.log` handlers in `handlePlayerReady`. Keep `onReady` if Video.js still needs the callback; it can be a no-op.
3. Add a speed control with 0.25, 0.5, 1, and 1.5. Default 1. Apply it with the player's `playbackRate` when the player is ready and when the choice changes.
4. Add a loop toggle that sets the player's `loop` option. Default off.
5. Reset speed to 1 and loop to off when the current item id changes, so the next clip does not inherit a slow-motion review.
6. Show these controls only for video. Place them under the frame or in the side panel above the file path, not on top of the picture controls Video.js already draws.

**Done when:**

- Arrow seek moves about a quarter second when the player has focus.
- 0.25× speed is visible and audible-free (the element stays muted only if it already was; playback audio follows the player default).
- Loop repeats the current clip until turned off.
- The next clip starts at 1× and not looping.
- The browser console stays quiet during ordinary play and close.

---

## 16. Reveal a file, copy its path, and mark missing files

**Status:** open

**Goal:** From the viewer, the user can open the file's folder in the system file manager and copy the path. Cards and the viewer show when the file is no longer on disk.

**Why:** The side panel prints `filepath` as the main metadata and offers no action. Nothing checks that the file still exists. The app has `tauri-plugin-dialog` only (`src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`).

**Touches:** `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`, `src-tauri/src/commands.rs`, `src/lib/media-api.ts`, `src/components/MediaModal.tsx`, `src/components/MediaCard.tsx`, `src/App.tsx`.

**Steps:**

1. Add the Tauri opener plugin (or the shell plugin's opener API that matches the installed Tauri 2 version) and grant only the permission needed to reveal a path. Do not grant a general shell.
2. Add a `reveal_media(media_id)` command that loads the stored path and asks the OS to show that file in its folder. If the file is missing, return a clear error.
3. In the modal, add Reveal and Copy path buttons. Copy writes `filepath` with `navigator.clipboard.writeText`. Reveal calls the command and shows the error inline if it fails.
4. Move the raw path under those buttons, in smaller type. The title shows the full filename with `line-clamp-2` and a `title` attribute, instead of slicing at 80 characters.
5. Add `missing_media_ids` or a boolean on each record from a command that checks `Path::exists` for the current library. Do not stat the disk on every render from the webview; do it in Rust when the library is listed and after an import. Missing files still appear in the grid.
6. On a missing card, show a "File missing" badge over the preview instead of a broken image. In the viewer, say the file is missing and disable Reveal's success path with the error from step 2. Copy path still works.

**Done when:**

- Reveal opens the system file manager with that file selected, on the OS this app is built for (the bundle target is deb, so verify on Linux).
- Copy path puts the absolute path on the clipboard.
- A library row whose file was removed from disk shows the missing badge and does not look like a successful photo.
- The filename in the viewer is no longer hard-cut at 80 characters.

---

## 17. Rescan a folder and remove one source folder

**Status:** open

**Goal:** The user can import again from a known folder without hunting for it, and can drop every library row that came from one import root. Files on disk stay.

**Why:** The only ingest entry is a fresh directory dialog. There is no record of which root produced which files, only each file's `filepath` and optional `group_path`. Deleting the whole library is the only bulk remove.

**Touches:** a new migration under `src-tauri/migrations/`, `src-tauri/src/db.rs`, `src-tauri/src/commands.rs`, `src/lib/media-api.ts`, `src/App.tsx` or `AppMenuModal.tsx`.

**Steps:**

1. Add a `LibraryRoot` table: id, path (unique), created_at. Add `root_id` on `Media`, nullable so existing rows survive.
2. On ingest, upsert the chosen directory as a root and set `root_id` on each inserted or updated file from that walk.
3. Backfill is not required for old rows. They stay `root_id` null until a rescan of their folder attaches them. Document that in a one-line comment next to the migration.
4. Add `list_roots` and show the roots in the app menu: path, file count, Rescan, Remove from library.
5. Rescan calls the existing ingest for that path and then marks rows with that `root_id` whose `filepath` was not seen in the walk. Do not delete those rows in this step; improvement 16's missing state should cover them. If improvement 16 is not done yet, still do not delete on rescan. Report "N new, N already present, N no longer on disk."
6. Remove from library deletes media rows (and their `MediaTag` rows) for that `root_id`, then the root row, inside one transaction. Confirm with the folder path and the count. Do not delete files on disk. If the selected sidebar tag disappears, fall back to All media.

**Done when:**

- Importing a folder creates a root entry that survives restart.
- Rescan of a folder that gained a file adds that file and reports it as new.
- Rescan does not duplicate files or clear tags.
- Remove from library drops only that root's rows and leaves other folders, and the files are still on disk.

---

## 18. Use file time instead of import time

**Status:** open

**Goal:** Newest and oldest follow the file's modified time, and the viewer shows that time. Import time stays available as its own field.

**Why:** `ingest_directory` sets `created_at` to `datetime('now')` for every new row. Re-import does not refresh it. The grid sort from improvement 5 therefore means "when it was first imported."

**Touches:** `src-tauri/migrations/`, `src-tauri/src/db.rs`, `src/lib/gallery.ts`, `src/components/MediaModal.tsx`, `src/types/media.ts`.

**Steps:**

1. Add `file_modified_at` on `Media`. On ingest, set it from the file metadata modified time for both insert and conflict update. Store UTC in the same style as the other timestamps.
2. Leave `created_at` as the first-import time. Do not overwrite it on conflict.
3. For rows that predate the column, leave `file_modified_at` null until the next rescan or ingest of that file. The sort falls back to `created_at` when the new field is null.
4. Change the gallery's newest and oldest sort to use `file_modified_at` with that fallback. Do not change tag or search behavior.
5. Show the file time in the viewer under the filename, formatted in the local timezone. If it is null, show the import time and label it "Imported".

**Done when:**

- Two files imported in one batch sort by their file times, not by whichever insert finished last.
- Re-importing after a file is touched updates the file time and does not clear tags or the original import time.
- The viewer shows a readable local time.
- Old rows still sort, using import time until they are ingested again.

---

## 19. Accept phone photos and drop a folder on the window

**Status:** open

**Goal:** HEIC and HEIF from a phone can enter the library and display. Dropping a folder on the window starts the same import as Add Folder.

**Why:** `infer_media_type` allows jpeg, png, gif, and webp only. iPhone photos are often HEIC. There is no drag-and-drop path. The WebKit view will not reliably decode HEIC by itself.

**Touches:** `src-tauri/src/db.rs`, ingest tests, `src/App.tsx`, `src-tauri/src/lib.rs` for the drag-drop event.

**Steps:**

1. Treat `.heic` and `.heif` as `PHOTO` in `infer_media_type`. Add a unit test that a HEIC file in a folder is inserted and a `.txt` is still skipped.
2. On ingest, transcode each new HEIC/HEIF to a JPEG next to the database, under `data/previews/<uuid>.jpg`, using a small image crate that can read HEIC if one is already acceptable to add, or an external `heif-convert` when it exists. If neither can run, still insert the row and mark it the way missing previews are marked, with the filename and a "Preview unavailable" state instead of a broken image. Do not fail the whole folder because one HEIC could not be decoded.
3. Point `fileUrl` for those rows at the JPEG preview when it exists. Keep `filepath` as the original HEIC so Reveal still opens the real file.
4. Listen for the Tauri window drag-drop event. If the drop contains a directory, call the same ingest path as Add Folder, including the result message from improvement 1. If it contains files, import the parent directory only when every dropped path is a file inside one directory; otherwise show "Drop a folder, not a loose file." Ignore drops while `isAdding` is true.
5. Show a full-window outline while a drag is over the window, and the text "Drop a folder to import".

**Done when:**

- A folder of JPEG and HEIC imports both, and a HEIC with a generated preview displays that preview.
- A HEIC that cannot be decoded still appears as a row with an explicit unavailable preview, and the rest of the folder imports.
- Dropping a folder shows the same counts as using the button.
- Dropping while an import is running does nothing.

---

## 20. Replace the app menu with settings, and undo a delete

**Status:** open

**Goal:** Ctrl+, opens a settings dialog titled for people, with the destructive action last. Deleting one item can be undone until another delete happens.

**Why:** `AppMenuModal` is titled `pickleball-media-organizer`. Its only action is Delete all. The shortcut hint is shown inside the dialog that the shortcut just opened. `delete_media` commits immediately and the UI drops the row.

**Touches:** `src/components/AppMenuModal.tsx`, `src/App.tsx`, `src-tauri/src/db.rs`, `src-tauri/src/commands.rs`, `src/lib/media-api.ts`.

**Steps:**

1. Rename the dialog title to "Settings". The description can stay a sentence about organizing local photos and videos. Show the version from `package.json` if it is already easy to import; otherwise show the string `0.1.0` from `tauri.conf.json` in one place, not both.
2. List shortcuts that exist: Ctrl+, for settings. Add Ctrl+O for Add Folder by listening in `App.tsx`, and document it here. Do not invent shortcuts that have no handler.
3. Move Delete all to the bottom of the dialog, still behind the existing confirm. The tag manager from improvement 10 and the roots from improvement 17 stay in this dialog if those improvements are done; if not, leave hooks out and do not build them early.
4. Add `restore_media` that reinserts a media row (same filepath, filename, type, description, group path, root id, file time) and its tag names, then returns the library. Call it only from undo, not from the UI as a general import.
5. On a successful single-item delete, keep the deleted payload in React state and show a line in the header: "Removed {filename}. Undo". Undo calls `restore_media` and clears the line. A second delete, a delete-all, or a restart drops the undo payload. Delete-all does not offer undo.
6. The native menu item label can stay short, but the dialog title must not be the package name.

**Done when:**

- Settings opens from the menu bar and from Ctrl+,, and Delete all is still confirmed.
- Ctrl+O opens the folder dialog.
- Deleting one clip shows Undo, and Undo puts that clip back with its tags and description.
- Undo is gone after a second delete or an app restart.
- Delete all still has no undo.

---

## 21. Stop holding every poster frame in memory

**Status:** open

**Goal:** Video cards still show a real frame, and a large library does not keep an unbounded set of JPEG data URLs alive.

**Why:** `posters` in `src/components/MediaCard.tsx` is a module-level `Map` from source URL to a data URL. It never evicts. Each visible card seeks a video and draws a canvas.

**Touches:** `src/components/MediaCard.tsx`. Optional later: write posters under `data/previews/` from Rust. Stay in the renderer for this improvement unless the map cap is not enough to stop duplicate decodes during one session.

**Steps:**

1. Cap the map at 80 entries. When a new poster is stored and the map is over the cap, delete the oldest inserted key. `Map` preserves insertion order, so delete the first key.
2. On a cache hit, refresh that key's position so recently shown cards are not the ones evicted.
3. If two cards share a source, they keep sharing one entry. Do not decode again while a poster exists.
4. When a card unmounts mid-decode, ignore the canvas result if the effect cleaned up. The existing effect already resets on `src` change; add a cancelled flag so a late `seeked` cannot set state on an unmounted card.
5. Keep the intersection observer and the 240px root margin. Do not raise it.

**Done when:**

- Scrolling a grid larger than 80 videos leaves at most 80 posters in the map.
- Coming back to a recently shown card uses the cached image and does not flicker to a blank tile.
- Navigating away from a card while its video is seeking does not warn about an update on an unmounted component.

---

## 22. Fit the window, and fix contrast, motion, fonts, and dark mode

**Status:** open

**Goal:** The window opens at a size that fits a laptop, the sidebar can hide, text on the court-green sidebar meets contrast, motion can be reduced, fonts work offline, and a dark theme can be turned on.

**Why:** `tauri.conf.json` sets 1920×1400 and no minimum. The sidebar is a fixed `w-64` (`src/components/Sidebar.tsx`). Section labels use `text-court-foreground/50` and empty tags use `/45`. `tailwind.config.cjs` sets `darkMode: ["class"]`, but `:root` in `src/index.css` has no `.dark` tokens. `index.css` loads Outfit from Google Fonts, which fails offline and is why the CSP allows `fonts.googleapis.com` and `fonts.gstatic.com`.

**Touches:** `src-tauri/tauri.conf.json`, `src/components/Sidebar.tsx`, `src/App.tsx`, `src/index.css`, `tailwind.config.cjs`, `index.html` only if a class must be set before paint.

**Steps:**

1. Set the default window to 1280×800. Set `minWidth` to 960 and `minHeight` to 640.
2. Add a sidebar toggle in the header. Collapsed, the aside is hidden and the grid uses the full width. Persist the choice in `localStorage`. Default expanded.
3. Raise the sidebar's quiet text from `/45` and `/50` to at least `/70` on `court-foreground`. Check the empty "No tags yet" line and the "Browse" / "Tags" labels against the court background.
4. Under `prefers-reduced-motion: reduce`, drop the card hover translate and scale, and shorten dialog animation to none. Tailwind's animate utilities can be overridden in `index.css` for that media query.
5. Self-host the Outfit files you actually use (400, 500, 600, 700) under something like `src/assets/fonts/`, and declare them with `@font-face`. Remove the Google Fonts `@import`. Remove the Google font hosts from the CSP in `tauri.conf.json` once nothing else requests them.
6. Add a `.dark` block that redefines the same CSS variables for background, card, foreground, border, and the court/ball pair so the court sidebar still reads as the dark brand and the main pane goes dark. Add a Light / Dark / System control in Settings. System follows `prefers-color-scheme`. Put the class on `document.documentElement` and persist it. Apply the saved class in `index.html` before the module script so the first paint does not flash the wrong theme.

**Done when:**

- A fresh launch opens at 1280×800 and cannot be resized below 960×640.
- The sidebar hides and stays hidden after a restart.
- Sidebar labels are readable on the green background.
- With reduced motion enabled, cards do not lift or zoom on hover.
- The app uses Outfit with the network blocked.
- Dark, light, and system each stick across a restart.

---

## Left out on purpose

These came up while reading the app and are not improvements in this list:

- Rewriting the UI in Solid.js. `docs/conversion-guide.md` is a separate migration, and the running app is still React.
- Editing video, drawing on frames, or exporting a highlight reel.
- Accounts, sync, or a phone companion.
- Deleting or moving the original file on disk. Every delete in this plan removes library rows only.
