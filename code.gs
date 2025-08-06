/**
 * YouTube Playlist Incremental Backup with Playlist & Video Caching
 * Public repo: https://github.com/raymelon/youtube-playlist-backup-apps-script
 * ---------------------------------------------------------------
 * Features:
 * 1. Playlist-level caching (preserve metadata even if inaccessible)
 * 2. Video-level incremental backup (append-only, avoids duplicates)
 * 3. Preserves deleted/private videos in Google Sheets
 * 4. Still includes pre-check function for listing playlists
 *
 * Setup:
 * 1. In Apps Script, enable YouTube Data API advanced service.
 * 2. Create sheets: Playlist_Cache (auto-managed), and per-playlist sheets.
 */

function listAllPlaylistsPreCheck() {
  generateReadmeSheetIfMissing();

  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Playlist_Check") ||
    SpreadsheetApp.getActiveSpreadsheet().insertSheet("Playlist_Check");

  const header = [
    "Timestamp",
    "Playlist Title",
    "Playlist ID",
    "Playlist URL",
    "Owned By Me",
    "Owner Channel URL",
    "Status",
    "My Account",
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
  }

  const existingData = sheet.getDataRange().getValues();
  const existingIds = new Set(existingData.slice(1).map((row) => row[2])); // skip header, collect Playlist ID

  const myEmail = Session.getActiveUser().getEmail();
  let nextPageToken = "";
  const timestamp = new Date();
  let allPlaylists = [];

  do {
    const response = YouTube.Playlists.list("snippet,status", {
      mine: true,
      maxResults: 50,
      pageToken: nextPageToken,
    });

    response.items.forEach((item) => {
      const playlistId = item.id;
      if (existingIds.has(playlistId)) return; // skip if already recorded

      const channelId = item.snippet.channelId;
      const ownerChannelUrl = channelId
        ? `https://www.youtube.com/channel/${channelId}`
        : "Unknown";
      const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

      allPlaylists.push({
        title: item.snippet.title,
        id: playlistId,
        owned: true,
        status: item.status.privacyStatus,
        owner: ownerChannelUrl,
        url: playlistUrl,
      });

      sheet.appendRow([
        timestamp,
        item.snippet.title,
        playlistId,
        playlistUrl,
        true,
        ownerChannelUrl,
        item.status.privacyStatus,
        myEmail,
      ]);
    });

    nextPageToken = response.nextPageToken;
  } while (nextPageToken);

  Logger.log(
    `Checked playlists. Found ${allPlaylists.length} new playlists added.`
  );
  Logger.log(
    "NOTE: External playlists you only follow will NOT appear here automatically."
  );

  return allPlaylists;
}

function incrementalBackupPlaylists() {
  generateReadmeSheetIfMissing();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cacheSheet =
    ss.getSheetByName("Playlist_Cache") || ss.insertSheet("Playlist_Cache");
  const timestamp = new Date();

  // Initialize cache header if empty
  if (cacheSheet.getLastRow() === 0) {
    cacheSheet.appendRow([
      "Playlist ID",
      "Playlist Title (Last Known)",
      "Owner Channel URL",
      "Owned By Me",
      "Playlist Status",
      "Last Video ID",
      "Last Index",
      "Last Backup Timestamp",
    ]);
  }

  // Load existing cache into memory
  const cacheData = cacheSheet.getDataRange().getValues();
  const header = cacheData.shift();
  const cacheMap = new Map(); // playlistId -> cache row object

  cacheData.forEach((row) => {
    cacheMap.set(row[0], {
      row,
      title: row[1],
      owner: row[2],
      owned: row[3],
      status: row[4],
      lastVideoId: row[5],
      lastIndex: row[6],
      lastBackup: row[7],
    });
  });

  // Fetch current playlists from YouTube API
  let nextPageToken = "";
  let playlists = [];
  do {
    const resp = YouTube.Playlists.list("snippet,status", {
      mine: true,
      maxResults: 50,
      pageToken: nextPageToken,
    });
    if (resp.items && resp.items.length)
      playlists = playlists.concat(resp.items);
    nextPageToken = resp.nextPageToken;
  } while (nextPageToken);

  const activeIds = new Set();

  playlists.forEach((pl) => {
    const playlistId = pl.id;
    const playlistTitle = pl.snippet.title;
    const ownerChannelUrl = `https://www.youtube.com/channel/${pl.snippet.channelId}`;
    activeIds.add(playlistId);

    // Update cache or insert new row
    if (cacheMap.has(playlistId)) {
      const cache = cacheMap.get(playlistId);
      cache.row[1] = playlistTitle;
      cache.row[2] = ownerChannelUrl;
      cache.row[3] = true;
      cache.row[4] = "Active";
    } else {
      const newRow = [
        playlistId,
        playlistTitle,
        ownerChannelUrl,
        true,
        "Active",
        "",
        "",
        timestamp,
      ];
      cacheSheet.appendRow(newRow); // persist immediately
      cacheMap.set(playlistId, {
        row: newRow,
        lastVideoId: "",
        lastIndex: "",
        lastBackup: timestamp,
      });
    }

    // Incremental backup of videos for this playlist
    const cache = cacheMap.get(playlistId);
    const sheetName = playlistTitle
      .replace(/[\/*?:\[\]]/g, "")
      .substring(0, 90);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        "Timestamp",
        "Playlist Title",
        "Playlist ID",
        "Video Position",
        "Video Title",
        "Video ID",
        "Video URL",
      ]);
    }

    const lastVideoId = cache.lastVideoId;
    let videoPageToken = "";
    let newVideos = [];
    let stop = false;
    let position = 0;

    do {
      const resp = YouTube.PlaylistItems.list("snippet", {
        playlistId: playlistId,
        maxResults: 50,
        pageToken: videoPageToken,
      });

      if (!resp.items || resp.items.length === 0) break;

      for (let i = 0; i < resp.items.length; i++) {
        const item = resp.items[i];
        const snippet = item.snippet;
        const videoId = snippet.resourceId.videoId;

        if (videoId === lastVideoId) {
          stop = true;
          break;
        }

        newVideos.push([
          timestamp,
          playlistTitle,
          playlistId,
          position + i,
          snippet.title,
          videoId,
          `https://www.youtube.com/watch?v=${videoId}`,
        ]);
      }

      position += resp.items.length;
      videoPageToken = stop ? null : resp.nextPageToken;
    } while (videoPageToken);

    // Append new videos to sheet (top = newest first)
    if (newVideos.length > 0) {
      // Insert new rows after header (row 1)
      sheet.insertRowsAfter(1, newVideos.length);

      // Write new videos starting at row 2
      sheet
        .getRange(2, 1, newVideos.length, newVideos[0].length)
        .setValues(newVideos);

      // Update existing video positions to shift down by newVideos.length
      updateVideoPositions(sheet, newVideos.length);
    }

    // Update cache with latest video info
    if (newVideos.length > 0) {
      cache.row[5] = newVideos[0][5]; // Last Video ID = newest video
      cache.row[6] = 0; // Last Index (position of newest)
      cache.row[7] = timestamp;
    } else {
      cache.row[7] = timestamp; // update backup time even if no new videos
    }
  });

  // Mark missing playlists as Inaccessible
  for (let [playlistId, cache] of cacheMap.entries()) {
    if (!activeIds.has(playlistId)) {
      cache.row[4] = "Inaccessible";
    }
  }

  // Rewrite cache sheet
  cacheSheet.clear();
  cacheSheet.appendRow(header);
  for (let cache of cacheMap.values()) {
    cacheSheet.appendRow(cache.row);
  }

  Logger.log("Incremental backup completed.");

  // After backup completes, perform one-way A→B presence-check deletions as configured.
  try {
    runOneWayPresenceDeletion(); // Non-breaking: new function defined below
  } catch (e) {
    Logger.log("runOneWayPresenceDeletion failed: " + e);
  }
}

function updateVideoPositions(sheet, offset) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // no data rows

  // Get the existing positions in the 'Video Position' column (4th column)
  const positionsRange = sheet.getRange(2 + offset, 4, lastRow - 1 - offset);
  const positions = positionsRange.getValues();

  for (let i = 0; i < positions.length; i++) {
    positions[i][0] = positions[i][0] + offset; // increment by offset
  }

  // Write back updated positions
  positionsRange.setValues(positions);
}

/**
 * Normalize the 'Video Position' column (D, col 4) so data rows are 0..N-1 from top to bottom.
 * Header is at row 1, so numbering starts at row 2 with 0.
 * Use only on deletion events to keep calls efficient.
 */
function normalizeVideoPositionsZeroBased(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // nothing to normalize

  const rowCount = lastRow - 1; // data rows (excluding header)
  const col = 4; // 'Video Position' column (D)
  const range = sheet.getRange(2, col, rowCount, 1);
  const values = new Array(rowCount).fill(0).map((_, i) => [i]); // 0..N-1

  range.setValues(values);
}

/**
 * Normalize the 'Video Position' column (D, col 4) so data rows are 0..N-1 from top to bottom.
 * Header is at row 1, so numbering starts at row 2 with 0.
 */
function normalizeVideoPositionsZeroBased(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // nothing to normalize

  const rowCount = lastRow - 1; // data rows (excluding header)
  const col = 4; // 'Video Position' column (D)
  const range = sheet.getRange(2, col, rowCount, 1);
  const values = new Array(rowCount).fill(0).map((_, i) => [i]); // 0..N-1

  range.setValues(values);
}

/**
 * One-way A→B presence-check deletion runner.
 * Config sheet: "2-way config"
 * Headers (exact):
 *   - "Playlist to delete the video"
 *   - "Playlist to check if video is there"
 *
 * Behavior:
 *   For each row (A,B):
 *     - Resolve A and B by ID or exact title from Playlist_Check.
 *     - Load all videoIds from B into a Set.
 *     - Iterate A's playlist items; if an item's videoId exists in B, delete that playlist item from A.
 * Notes:
 *   - No dry run; this performs real deletions.
 *   - Ambiguous titles (duplicates) are skipped with a warning.
 *   - Keeps existing backup logic intact; this is called at the end of incrementalBackupPlaylists().
 */
function runOneWayPresenceDeletion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const pairs = readTwoWayConfig_();
  if (pairs.length === 0) {
    Logger.log('[A→B] No valid rows found in "2-way config". Nothing to do.');
    return;
  }

  // Load Playlist_Check cache to support title resolution logging later if needed
  const playlistCheckCache = loadPlaylistCheckCache_();

  // Cache for B playlist videoId sets: playlistId -> Set(videoId)
  const bPresenceCache = new Map();

  let totalChecked = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const { deleteFromId: aId, checkInId: bId, rowIndex } of pairs) {
    try {
      // Build or reuse presence set for B
      let bSet = bPresenceCache.get(bId);
      if (!bSet) {
        bSet = buildVideoIdSet_(bId);
        bPresenceCache.set(bId, bSet);
        Logger.log(
          `[A→B] Built presence set for B (${bId}) with ${bSet.size} videos.`
        );
      }

      // Iterate A and delete items whose videoId is present in B
      const items = listPlaylistItems_(aId); // array of { playlistItemId, videoId }
      let rowChecked = 0;
      let rowDeleted = 0;
      let rowSkipped = 0;

      // Track deleted videoIds to sync A's sheet afterwards
      const deletedVideoIds = new Set();

      for (const it of items) {
        rowChecked++;
        if (bSet.has(it.videoId)) {
          try {
            // Real deletion
            YouTube.PlaylistItems.remove(it.playlistItemId);
            rowDeleted++;
            deletedVideoIds.add(it.videoId);
          } catch (delErr) {
            rowSkipped++; // treat as skipped, but count an error
            totalErrors++;
            Logger.log(
              `[A→B][Row ${rowIndex}] Failed to delete item ${it.playlistItemId} from A (${aId}): ${delErr}`
            );
          }
        } else {
          rowSkipped++;
        }
      }

      // Sheet-sync: delete rows in-place from A's per-playlist sheet where Video ID (column F) matches deleted items
      try {
        if (deletedVideoIds.size > 0) {
          const aTitle = playlistCheckCache.idToTitle.get(aId) || aId; // fallback to ID if unknown
          const sheetName = String(aTitle)
            .replace(/[\/*?:\[\]]/g, "")
            .substring(0, 90);
          const aSheet = ss.getSheetByName(sheetName);
          if (aSheet) {
            const lastRow = aSheet.getLastRow();
            if (lastRow > 1) {
              // Read only Video ID column F (6), rows 2..lastRow
              const videoIdCol = aSheet
                .getRange(2, 6, lastRow - 1, 1)
                .getValues();
              const rowsToDelete = [];
              for (let i = 0; i < videoIdCol.length; i++) {
                const vid = String(videoIdCol[i][0] || "").trim();
                if (deletedVideoIds.has(vid)) {
                  // absolute row index in sheet
                  rowsToDelete.push(i + 2);
                }
              }
              // Delete bottom-up to avoid index shifts
              rowsToDelete.sort((a, b) => b - a);
              for (const rowNum of rowsToDelete) {
                aSheet.deleteRow(rowNum);
              }
              if (rowsToDelete.length > 0) {
                // Normalize positions after deletions: set Video Position (column D) to 0..N-1 top-down
                try {
                  normalizeVideoPositionsZeroBased(aSheet);
                } catch (posErr) {
                  Logger.log(
                    `[A→B][Row ${rowIndex}] normalizeVideoPositionsZeroBased warning for "${sheetName}": ${posErr}`
                  );
                }
                Logger.log(
                  `[A→B][Row ${rowIndex}] Synced A sheet "${sheetName}": removed ${rowsToDelete.length} rows matching deleted Video IDs (column F).`
                );
              }
            }
          } else {
            Logger.log(
              `[A→B][Row ${rowIndex}] A sheet not found for "${aTitle}" while syncing deletions. Skipped sheet update.`
            );
          }
        }
      } catch (sheetErr) {
        totalErrors++;
        Logger.log(
          `[A→B][Row ${rowIndex}] Sheet sync error for A=${aId}: ${sheetErr}`
        );
      }

      totalChecked += rowChecked;
      totalDeleted += rowDeleted;
      totalSkipped += rowSkipped;

      Logger.log(
        `[A→B][Row ${rowIndex}] A=${aId} B=${bId} | Checked=${rowChecked}, Deleted=${rowDeleted}, Skipped=${rowSkipped}`
      );
    } catch (err) {
      totalErrors++;
      Logger.log(
        `[A→B][Row ${rowIndex}] Error processing pair A=${aId}, B=${bId}: ${err}`
      );
    }
  }

  Logger.log(
    `[A→B] Summary | Checked=${totalChecked}, Deleted=${totalDeleted}, Skipped=${totalSkipped}, Errors=${totalErrors}`
  );
}

/**
 * Read and validate "2-way config" sheet.
 * Returns array of { deleteFromId, checkInId, rowIndex } using resolved IDs.
 */
function readTwoWayConfig_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "2-way config";
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // Auto-create config sheet with headers and a default A/B row as requested.
    sheet = ss.insertSheet(sheetName);
    const headers = [
      "Playlist to delete the video",
      "Playlist to check if video is there",
    ];
    sheet.appendRow(headers);
    sheet.appendRow([
      "Watch Later 2 - since 9-24-2024",
      "Bookmark videos 2 - since 03-22-2023",
    ]);
    Logger.log(
      `[A→B] Created config sheet "${sheetName}" with default A/B row.`
    );
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    Logger.log("[A→B] Config sheet is empty (unexpected after auto-create).");
    return [];
  }

  const header = values[0].map((h) => String(h).trim());
  const colA = header.indexOf("Playlist to delete the video");
  const colB = header.indexOf("Playlist to check if video is there");

  if (colA === -1 || colB === -1) {
    Logger.log(
      '[A→B] Config sheet headers missing. Required: "Playlist to delete the video", "Playlist to check if video is there"'
    );
    return [];
  }

  const playlistCheckCache = loadPlaylistCheckCache_();

  const results = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rawA = String(row[colA] || "").trim();
    const rawB = String(row[colB] || "").trim();
    if (!rawA || !rawB) continue;

    const aId = resolvePlaylistId_(rawA, playlistCheckCache);
    const bId = resolvePlaylistId_(rawB, playlistCheckCache);

    if (!aId) {
      Logger.log(
        `[A→B][Row ${i + 1}] Could not resolve A: "${rawA}". Skipping row.`
      );
      continue;
    }
    if (!bId) {
      Logger.log(
        `[A→B][Row ${i + 1}] Could not resolve B: "${rawB}". Skipping row.`
      );
      continue;
    }

    results.push({ deleteFromId: aId, checkInId: bId, rowIndex: i + 1 });
  }

  return results;
}

/**
 * Load Playlist_Check into caches for ID/title resolution.
 * Returns { titleToIds: Map<title, string[]>, idToTitle: Map<id, title> }
 */
function loadPlaylistCheckCache_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Playlist_Check");
  const cache = {
    titleToIds: new Map(),
    idToTitle: new Map(),
  };

  if (!sheet) return cache;

  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) return cache;

  const header = values[0].map((h) => String(h).trim());
  const idxTitle = header.indexOf("Playlist Title");
  const idxId = header.indexOf("Playlist ID");

  if (idxTitle === -1 || idxId === -1) return cache;

  for (let i = 1; i < values.length; i++) {
    const title = String(values[i][idxTitle] || "").trim();
    const id = String(values[i][idxId] || "").trim();
    if (!title || !id) continue;

    const arr = cache.titleToIds.get(title) || [];
    arr.push(id);
    cache.titleToIds.set(title, arr);
    cache.idToTitle.set(id, title);
  }

  return cache;
}

/**
 * Resolve a playlist reference that can be an ID or an exact title.
 * - If value looks like a playlist ID (starts with 'PL' or 'UU' or 'LL' etc.), return as-is.
 * - Else, look up exact title in Playlist_Check. If ambiguous, log and return null.
 */
function resolvePlaylistId_(value, playlistCheckCache) {
  const v = String(value).trim();

  // Basic heuristic for playlist IDs (YouTube playlist IDs often start with 'PL', but can vary like 'UU', 'LL', etc.)
  const idLike = /^[A-Za-z0-9_-]{10,}$/; // reasonable length/pattern
  if (
    idLike.test(v) &&
    (v.startsWith("PL") ||
      v.startsWith("UU") ||
      v.startsWith("LL") ||
      v.startsWith("FL"))
  ) {
    return v;
  }

  // Exact title match via cache
  const ids = playlistCheckCache.titleToIds.get(v) || [];
  if (ids.length === 1) return ids[0];
  if (ids.length === 0) {
    Logger.log(`[A→B] Title not found in Playlist_Check: "${v}"`);
    return null;
  }
  // Ambiguous
  Logger.log(
    `[A→B] Ambiguous title in Playlist_Check: "${v}" matches ${ids.length} playlists. Skipping.`
  );
  return null;
}

/**
 * List all playlist items for a playlistId.
 * Returns array of { playlistItemId, videoId }.
 */
function listPlaylistItems_(playlistId) {
  let pageToken = "";
  const out = [];

  do {
    const resp = YouTube.PlaylistItems.list("snippet", {
      playlistId: playlistId,
      maxResults: 50,
      pageToken: pageToken || undefined,
    });

    if (!resp.items || resp.items.length === 0) break;

    for (let i = 0; i < resp.items.length; i++) {
      const item = resp.items[i];
      const snippet = item.snippet;
      const videoId =
        snippet && snippet.resourceId ? snippet.resourceId.videoId : null;
      const playlistItemId = item.id;
      if (videoId && playlistItemId) {
        out.push({ playlistItemId, videoId });
      }
    }

    pageToken = resp.nextPageToken;
  } while (pageToken);

  return out;
}

/**
 * Build a Set of videoIds present in the given playlistId.
 */
function buildVideoIdSet_(playlistId) {
  const items = listPlaylistItems_(playlistId);
  const set = new Set();
  for (const it of items) {
    set.add(it.videoId);
  }
  return set;
}

/**
 * Ensure a README sheet exists with repo link, author credit, and MIT License text.
 * Idempotent: if "README" sheet already exists, it does nothing.
 */
function generateReadmeSheetIfMissing() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const SHEET_NAME = "README";
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    // Ensure README is the first sheet
    try {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(1);
    } catch (e) {
      Logger.log("README reordering warning: " + e);
    }
  } else {
    sheet = ss.insertSheet(SHEET_NAME);
    // Place README as the first sheet
    try {
      ss.setActiveSheet(sheet);
      ss.moveActiveSheet(1);
    } catch (e) {
      Logger.log("README ordering warning: " + e);
    }
  }

  // Content
  const title = "YouTube Playlist Backup - README";
  const playlistScriptLine =
    "Playlist script: https://script.google.com/u/0/home/projects/1NAoattHbLky184Dy1RyJ3iVXNS-Cq6bsHeE9If3Eq31PaexregM7Ygt6/edit";
  const repoLine =
    "Public Repo: https://github.com/raymelon/youtube-playlist-backup-apps-script";
  const authorLine =
    "Written By: Raymel Francisco (https://github.com/raymelon)";
  const sectionBreak = "—";
  const licenseHeader = "MIT License";
  const licenseBody = [
    "MIT License",
    "",
    "Copyright (c) 2025 Raymel Francisco",
    "",
    "Permission is hereby granted, free of charge, to any person obtaining a copy",
    'of this software and associated documentation files (the "Software"), to deal',
    "in the Software without restriction, including without limitation the rights",
    "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell",
    "copies of the Software, and to permit persons to whom the Software is",
    "furnished to do so, subject to the following conditions:",
    "",
    "The above copyright notice and this permission notice shall be included in all",
    "copies or substantial portions of the Software.",
    "",
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
    "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,",
    "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE",
    "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER",
    "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,",
    "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE",
    "SOFTWARE.",
  ];

  const intro = [
    title,
    "",
    playlistScriptLine,
    repoLine,
    authorLine,
    "",
    sectionBreak,
    "This Google Sheets–bound Apps Script performs incremental backups of your YouTube playlists,",
    "caches playlist metadata (including for removed/private items), and provides optional",
    "one-way presence-check deletions between playlists via the '2-way config' sheet.",
    "",
    "Key entry points:",
    " - listAllPlaylistsPreCheck(): Populate/refresh Playlist_Check with owned playlists.",
    " - incrementalBackupPlaylists(): Incrementally append new videos to per-playlist sheets",
    "   and maintain a Playlist_Cache of last-known metadata.",
    "",
    sectionBreak,
    "",
    licenseHeader,
    "",
  ];

  const content = intro.concat(licenseBody);

  // Write content to column A
  const rows = content.map((line) => [line]);
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);

  // Formatting
  try {
    sheet.setColumnWidth(1, 900);
    sheet.getRange(1, 1).setFontWeight("bold").setFontSize(14);
    sheet.getRange(3, 1).setFontWeight("bold"); // repo
    sheet.getRange(4, 1).setFontStyle("italic"); // author
    sheet.getRange(1, 1, rows.length, 1).setWrap(true);
    sheet.setFrozenRows(1);
  } catch (e) {
    Logger.log("README formatting warning: " + e);
  }

  Logger.log("README sheet created.");
}
