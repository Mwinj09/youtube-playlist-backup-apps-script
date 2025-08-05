# YouTube Playlist Backup into Google Sheets (Google Apps Script)

Back up your YouTube playlists into Google Sheets.

- Written in Google Apps Script (.gs)

- Keeps a single tab with your owned playlists and basic metadata

- Creates one sheet per playlist and appends new videos at the top

- Stores last-known state per playlist so backups are fast and append-only

- Playlist One-way sync: Configure Playlist A to sync to Playlist B. On each backup run, if a video in playlist A exists in playlist B, it’s removed from A

---

## Table of Contents

- [What this does](#what-this-does)
  - [Playlist overview (Playlist_Check)](#1-playlist-overview-playlist_check)
  - [Per‑playlist video logs](#2-perplaylist-video-logs)
  - [Incremental caching (Playlist_Cache)](#3-incremental-caching-playlist_cache)
  - [Playlist one-way sync (runs every backup)](#4-playlist-one-way-sync-runs-every-backup)
- [No-duplicates backups and playlist one-way sync deletions](#no-duplicates-backups-and-playlist-one-way-sync-deletions)
  - [New videos are added without duplicates](#new-videos-are-added-without-duplicates)
  - [Each backup can remove videos from A if they exist in B](#each-backup-can-remove-videos-from-a-if-they-exist-in-b)
- [Set up (one-time)](#set-up-one-time)
- [How to use](#how-to-use)
  - [Step 1: Pre-check your playlists](#step-1-pre-check-your-playlists)
  - [Step 2: Backup your playlists](#step-2-backup-your-playlists)
  - [Step 3: Configure playlist one-way sync (after first run)](#step-3-configure-playlist-one-way-sync-after-first-run)
- [Sheets created](#sheets-created)
- [Troubleshooting (quick)](#troubleshooting-quick)
- [Notes](#notes)

## What this does

### 1) Playlist overview (Playlist_Check)

Keeps a single tab with your owned playlists and basic metadata.

- How it’s created: Run `listAllPlaylistsPreCheck()`.
- Why it matters: Provides a reliable source of truth for titles and IDs, which helps the playlist one-way sync rules resolve playlists correctly.
- When it updates: On each pre-check run (ideally daily at 12:00 AM).

### 2) Per‑playlist video logs

Creates one sheet per playlist and appends new videos at the top.

- Created/updated by: `incrementalBackupPlaylists()`.
- Columns: Timestamp, Playlist Title, Playlist ID, Video Position (0-based), Video Title, Video ID, Video URL.
- Behavior: Only new videos since the last run are inserted; positions adjust automatically.

### 3) Incremental caching (Playlist_Cache)

Stores last-known state per playlist so backups are fast and append-only.

- What’s cached: Last Video ID seen, last index, last backup time, and status (Active/Inaccessible).
- Why it matters: Prevents scanning everything every time and preserves state even if a playlist becomes inaccessible later.

### 4) Playlist one-way sync (runs every backup)

On each backup, if a video in playlist A exists in playlist B, it’s removed from A.

- Configured in: “2-way config” sheet (auto-created by the script if missing).
- Headers (exact text): “Playlist to delete the video” (A) and “Playlist to check if video is there” (B).
- Example: A = “Watch Later”, B = “Bookmark Videos” → videos already bookmarked are removed from Watch Later.
- Sheet sync: Matching rows are also removed from A’s per‑playlist sheet, and positions are normalized.

---

## No-duplicates backups and playlist one-way sync deletions

### New videos are added without duplicates

- How duplicates are avoided: The backup uses a “last known newest video ID” per playlist, stored in the `Playlist_Cache`. When the backup runs, it fetches items from YouTube and stops as soon as it reaches that last saved video.
- Insert strategy: New videos found since the previous run are inserted at the top (row 2), keeping the header in row 1. Existing rows shift down, and the “Video Position” column is updated accordingly.
- Result: Each run appends only the true new videos since your last backup; existing entries are not duplicated.

### Each backup can remove videos from A if they exist in B

- Always on during backup: The playlist one-way sync presence check runs at the end of every `incrementalBackupPlaylists()` execution.
- What it does: For each row in “2-way config”, the script builds a set of all Video IDs in playlist B, then iterates items in playlist A and removes those whose Video IDs exist in B.
- Sheet syncing: After deletion on YouTube, the script also removes matching rows (by Video ID, column F) in A’s per‑playlist sheet and renumbers “Video Position” top‑down to 0..N−1.
- Recommended workflow: A = “Watch Later”, B = “Bookmark Videos” to automatically clean up Watch Later for anything you’ve already bookmarked.

Tips:

- Use playlist IDs in “2-way config” to avoid ambiguity.
- If using titles (exact matches), keep “Playlist_Check” fresh via the daily pre-check.

---

## Set up (one-time)

1. Start from a new Google Sheet

   - Google Drive → New → Google Sheets.

2. Open the Sheet’s Apps Script editor

   - In your Sheet: Extensions → Apps Script (opens the bound Apps Script project).

3. Add the code

   - In the Apps Script editor, create `code.gs` and paste the contents from this repo’s [`code.gs`](code.gs).

4. Enable YouTube advanced service

   - Left sidebar → Services (puzzle icon) → Add a service → choose “YouTube Data API”.

5. First run & permissions
   - Run any function once (e.g., `listAllPlaylistsPreCheck()`).
   - Approve the authorization prompts for:
     - Google Sheets (read/write tabs)
     - YouTube Data API (list playlists, read items, remove items for playlist one-way sync rules)

---

## How to use

### Step 1: Pre-check your playlists

- Run `listAllPlaylistsPreCheck()` to create/update “Playlist_Check” with your owned playlists.
- Why: Enables title→ID resolution used by playlist one-way sync and gives you a quick audit.

Automate (recommended):

- In Apps Script → Triggers (clock icon) → Add Trigger
  - Function: `listAllPlaylistsPreCheck`
  - Event source: Time-driven → Day timer → 12:00 AM daily

### Step 2: Backup your playlists

- Run `incrementalBackupPlaylists()` to:
  - Update “Playlist_Cache”
  - Create/update one sheet per playlist
  - Insert only new videos at the top (since last run)

Automate (recommended):

- In Apps Script → Triggers (clock icon) → Add Trigger
  - Function: `incrementalBackupPlaylists`
  - Event source: Time-driven → Day timer → 1:00 AM daily

Why this schedule:

- Pre-check at 12:00 AM keeps “Playlist_Check” fresh.
- Backup at 1:00 AM ensures the latest title/ID data is available and then applies playlist one-way sync rules.

### Step 3: Configure playlist one-way sync (after first run)

- The “2-way config” sheet is auto-created if missing. Configure it only after the first successful run so the sheet exists.
- Add rows under two exact headers:
  - “Playlist to delete the video” (A)
  - “Playlist to check if video is there” (B)
- Use playlist IDs (preferred) or exact titles from “Playlist_Check”.
- Example: A = “Watch Later”, B = “Bookmark Videos”  
  On every backup, if a video from A is found in B, it’s deleted from A and the A sheet is synced.

Tips:

- Prefer IDs to avoid title ambiguity.
- If you use titles, keep “Playlist_Check” refreshed via the pre-check trigger.

---

## Sheets created

- Playlist_Check

  - Overview of your playlists (title, ID, URL, owner, status, etc.).

- Playlist_Cache

  - Stores last-known info per playlist (status, last video ID, last backup time).

- One sheet per playlist

  - Columns: Timestamp, Playlist Title, Playlist ID, Video Position (0-based), Video Title, Video ID, Video URL.
  - New videos appear at the top; positions update automatically.

- 2-way config
  - Two columns (exact text):
    - “Playlist to delete the video”
    - “Playlist to check if video is there”

---

## Troubleshooting (quick)

- playlist one-way sync does nothing:

  - Ensure “2-way config” headers match exactly.
  - Use valid playlist IDs or titles that exist in “Playlist_Check”.

- Titles don’t resolve:

  - Run `listAllPlaylistsPreCheck()` first, or use playlist IDs.

- Deletions happened, but rows didn’t update:
  - The script syncs the per‑playlist sheet by Video ID (column F). Check the sheet name (sanitized/truncated title) and that Video IDs exist in column F.

---

## Notes

- Backups are append-only: previously captured rows remain even if the video is later removed from YouTube.
- Deletions from A are real (no dry run). Configure carefully and test on non-critical playlists if unsure.
