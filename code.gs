/**
 * YouTube Playlist Incremental Backup with Playlist & Video Caching
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
 *
 */

function listAllPlaylistsPreCheck() {
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
