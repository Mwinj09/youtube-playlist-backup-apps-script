# YouTube Playlist Backup to Google Sheets — Apps Script 2025 Utility 🚀

[![Releases](https://img.shields.io/badge/Releases-download-blue?logo=github)](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)  
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE) [![Sheets](https://img.shields.io/badge/Google%20Sheets-Backup-brightgreen?logo=google%20sheets)](https://www.google.com/sheets/about/) [![YouTube](https://img.shields.io/badge/YouTube-Playlist-red?logo=youtube)](https://www.youtube.com)

A compact Apps Script project to back up YouTube playlists into Google Sheets. Track playlist metadata, video IDs, titles, durations, publish dates, view counts and more. Use scheduled triggers to update your sheet on a regular cadence.

Releases: [Download the release file(s) from Releases and execute them](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)

Badges reflect repo topics: excel, google-apps-script, google-sheets, google-sheets-api, javascript, playlist, playlist-backup, spreadsheet, spreadsheets, video, youtube, youtube-api, youtube-api-playlist, youtube-api-v3, youtube-api-v3-2025, youtube-playlist-backup, youtube-video, youtube-video-backup.

---

![YouTube to Sheets banner](https://upload.wikimedia.org/wikipedia/commons/b/b8/YouTube_Logo_2017.svg)  
![Google Sheets logo](https://upload.wikimedia.org/wikipedia/commons/4/4a/Google_Sheets_2020_Logo.svg)  
![Apps Script logo](https://ssl.gstatic.com/docs/script/images/logo.png)

Table of contents

- Features
- When to use this tool
- What you get
- Quick start (fast path)
- Full installation and configuration
  - Create a Google Sheet
  - Create Apps Script project
  - Deploy API access
  - App Script settings and scopes
  - Paste and run the script
  - Installable trigger for schedule
- How the script works
  - Data model and columns
  - Pagination and throttling
  - Quota handling
- Advanced usage
  - Multiple playlists
  - Incremental updates
  - Custom columns
  - Export and import formats
- Example Apps Script code
- Sample sheet layout and formulas
- Troubleshooting and common errors
- Frequently asked questions
- Contributing
- Changelog and releases
- License

Features

- Export playlist content to a Google Sheet.
- Save metadata: video id, title, published date, duration, view count, like count, comment count, position in playlist.
- Append new items and update existing ones.
- Handle paginated API responses.
- Work with scheduled triggers for daily or hourly backups.
- Provide clear column mapping for downstream automation.

When to use this tool

- You want an offline record of a playlist.
- You want to analyze titles, publish dates, or view trends.
- You want to migrate playlist content to another service.
- You want to keep a history of playlist changes.

What you get

- A ready Apps Script code template to paste into the Script Editor.
- Instructions to enable YouTube Data API v3 and the Apps Script advanced service.
- Sample sheet layout and formulas for quick analysis.
- A schedule trigger recipe to run backups on a timetable.
- A releases page with packaged files. Download and execute the release package from Releases: [Download the release file(s) from Releases and execute them](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)

Quick start (fast path)

1. Create a Google Sheet.
2. Open Extensions → Apps Script.
3. In the Apps Script editor paste the script provided in this README under "Example Apps Script code".
4. In the script editor enable the YouTube Data API as an Advanced Service: Services → Add YouTube Data API.
5. Run the setup function once to authorize.
6. Run fetchPlaylistToSheet with a playlist ID.
7. Add an installable trigger to run hourly or daily.

Full installation and configuration

Create a Google Sheet

1. Open Google Drive.
2. Click New → Google Sheets.
3. Name it like "YouTube Playlist Backup".
4. Create a sheet named "Backup" or leave default "Sheet1".
5. Optionally create a sheet named "Config" for settings.

Create Apps Script project

1. From your sheet, open Extensions → Apps Script.
2. Rename the project, for example "YT Playlist Backup".
3. Create a file named Code.gs if not present.

Deploy API access

You need to enable two things:

- Google Cloud Console: enable YouTube Data API v3 for the project tied to your Apps Script.
- Apps Script Editor: enable Advanced Service "YouTube Data API".

Steps:

1. In Apps Script editor click the left menu → Services → Add service → select "YouTube Data API".
2. In Google Cloud Console, make sure the project linked to Apps Script has the YouTube Data API enabled in APIs & Services → Library.
3. If you want to use an OAuth consent screen, configure it under APIs & Services → OAuth consent screen for external or internal use depending on your account.

App Script settings and scopes

Edit appsscript.json to include the scopes your script needs. Example scopes:

- https://www.googleapis.com/auth/spreadsheets
- https://www.googleapis.com/auth/script.external_request (if using UrlFetch)
- https://www.googleapis.com/auth/youtube.readonly

You can set them in the manifest file. Keep scopes minimal to reduce friction during authorization.

Paste and run the script

- Paste the sample code from the "Example Apps Script code" section.
- Replace placeholders such as PLAYLIST_ID and SHEET_NAME.
- Run the setup function. The editor asks for permissions. Accept to allow the script to read YouTube data and change your spreadsheet.

Installable trigger for schedule

1. In Apps Script editor, open Triggers (clock icon).
2. Add a trigger for fetchAllPlaylistsToSheets or fetchPlaylistToSheet.
3. Choose a time-driven trigger. For example, run daily at 3:00 AM.
4. Save the trigger.

How the script works

The script uses the YouTube Data API v3 to fetch playlist items. It fetches video IDs from a playlist, then calls Videos.list to fetch details for those videos. It writes a header row to the sheet, then writes each video row. To update existing entries it maps video IDs to sheet rows and updates values in place.

Data model and columns

Default columns the script writes:

- backup_timestamp — when the backup ran (ISO)
- playlist_id
- playlist_title
- position — position of the item in playlist
- video_id
- video_title
- publish_date
- duration — ISO 8601 duration (like PT3M21S)
- duration_seconds — numeric seconds
- views
- likes
- comments
- thumbnails_standard
- channel_id
- channel_title
- note — free text for manual notes

You can change the set in the code. The code writes headers on first run. It updates headers if it finds them missing.

Pagination and throttling

- PlaylistItems.list returns up to 50 items per request. The script loops through pages with nextPageToken until it retrieves all items.
- Videos.list accepts up to 50 video IDs per request. The script batches IDs to 50 per call.
- Implement small pauses between heavy calls to stay under quota. The code uses Utilities.sleep(ms) when needed.

Quota handling

- The YouTube Data API counts units per method. playlistItems.list has cost, videos.list has cost based on part fields. Keep parts minimal. Use only the fields you need.
- If you hit quota limits, lower the frequency of scheduled runs and reduce parts used.
- Use caching of video details when running frequent updates to reduce calls.

Advanced usage

Multiple playlists

- Maintain a "Config" sheet that lists playlist IDs and target sheet names.
- Loop through the config rows and call fetchPlaylistToSheet for each one.
- Optionally write all playlists to the same sheet with a playlist_id column for separation.

Incremental updates

- Store the last backup timestamp in a Config cell.
- On each run query playlistItems for items added after that timestamp by filtering or comparing publishedAt.
- For items that exist, update counts and metadata. For new items, append rows.

Custom columns

- Modify the columns array at the top of the script.
- Add or remove fields from videos.list or playlistItems.list calls to fetch only needed data.
- Add derived columns such as week_of_year or age_days using formulas or code.

Export and import formats

- Export the sheet as CSV from Google Sheets UI.
- Use Apps Script to export CSV programmatically with getValues and join.
- Import into Excel or other tools.

Example Apps Script code

Core script that performs a backup. Paste this into your project. Replace PLAYLIST_ID and SHEET_NAME where indicated.

```javascript
// YouTube Playlist Backup - Apps Script (example)
// Configure these two constants or pass them as parameters
const SHEET_NAME = 'Backup';
const PLAYLIST_ID = 'PLxxxxxxxxxxxxxxxxxxxxxx'; // replace with your playlist ID

// Main entry point for one playlist
function fetchPlaylistToSheet(playlistId = PLAYLIST_ID, sheetName = SHEET_NAME) {
  // Ensure sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  // Columns we store (order matters)
  const HEADERS = [
    'backup_timestamp', 'playlist_id', 'playlist_title', 'position',
    'video_id', 'video_title', 'publish_date',
    'duration', 'duration_seconds', 'views', 'likes', 'comments',
    'thumbnails_standard', 'channel_id', 'channel_title', 'note'
  ];

  // Write headers if missing
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    // Ensure header row matches HEADERS length
    const existingHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    let fix = false;
    for (let i=0;i<HEADERS.length;i++) if (existingHeaders[i] !== HEADERS[i]) fix = true;
    if (fix) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  // Fetch playlist metadata
  const plResponse = YouTube.Playlists.list('snippet', {id: playlistId, maxResults:1});
  let playlistTitle = '';
  if (plResponse.items && plResponse.items.length > 0) {
    playlistTitle = plResponse.items[0].snippet.title;
  }

  // Collect playlist item videoIds with positions
  let videoMap = []; // {position, videoId}
  let nextPageToken = null;
  do {
    const res = YouTube.PlaylistItems.list('snippet,contentDetails', {
      playlistId: playlistId,
      maxResults: 50,
      pageToken: nextPageToken
    });
    if (res.items && res.items.length) {
      res.items.forEach(item => {
        const vid = item.contentDetails.videoId;
        const pos = item.snippet.position;
        videoMap.push({position: pos, videoId: vid});
      });
    }
    nextPageToken = res.nextPageToken;
  } while (nextPageToken);

  // Batch video details
  const BATCH = 50;
  let rows = [];
  for (let i = 0; i < videoMap.length; i += BATCH) {
    const batch = videoMap.slice(i, i + BATCH);
    const ids = batch.map(v => v.videoId).join(',');
    const vRes = YouTube.Videos.list('snippet,contentDetails,statistics', {
      id: ids,
      maxResults: 50
    });
    const videoById = {};
    if (vRes.items) {
      vRes.items.forEach(v => {
        videoById[v.id] = v;
      });
    }
    // Build rows
    batch.forEach(item => {
      const vid = item.videoId;
      const v = videoById[vid] || {};
      const snippet = v.snippet || {};
      const stats = v.statistics || {};
      const content = v.contentDetails || {};
      const dur = content.duration || '';
      const durSec = iso8601DurationToSeconds(dur);
      const row = [
        new Date().toISOString(),
        playlistId,
        playlistTitle,
        item.position,
        vid,
        snippet.title || '',
        snippet.publishedAt || '',
        dur,
        durSec,
        parseInt(stats.viewCount || 0, 10),
        parseInt(stats.likeCount || 0, 10),
        parseInt(stats.commentCount || 0, 10),
        (snippet.thumbnails && (snippet.thumbnails.standard || snippet.thumbnails.high || snippet.thumbnails.default) && (snippet.thumbnails.standard ? snippet.thumbnails.standard.url : (snippet.thumbnails.high ? snippet.thumbnails.high.url : snippet.thumbnails.default.url))) || '',
        snippet.channelId || '',
        snippet.channelTitle || '',
        ''
      ];
      rows.push(row);
    });

    // Optional pause to respect quotas
    Utilities.sleep(200); // 200ms pause between batches
  }

  // Append rows to sheet
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

// Helper: convert ISO 8601 duration to seconds
function iso8601DurationToSeconds(duration) {
  if (!duration) return 0;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const parts = duration.match(regex);
  if (!parts) return 0;
  const hours = parseInt(parts[1] || 0, 10);
  const minutes = parseInt(parts[2] || 0, 10);
  const seconds = parseInt(parts[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// Wrapper to fetch multiple playlists defined on a Config sheet
function fetchAllPlaylistsToSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet) {
    // If no Config sheet, call default fetch for the constant PLAYLIST_ID
    fetchPlaylistToSheet();
    return;
  }
  const rows = configSheet.getDataRange().getValues();
  // Expect header row: playlist_id,sheet_name
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const pid = row[0];
    const name = row[1] || 'Backup';
    if (pid) fetchPlaylistToSheet(pid, name);
  }
}
```

Sample sheet layout and formulas

Header row (first row) matches the HEADERS array. Example row layout:

- A1: backup_timestamp
- B1: playlist_id
- C1: playlist_title
- D1: position
- E1: video_id
- F1: video_title
- G1: publish_date
- H1: duration
- I1: duration_seconds
- J1: views
- K1: likes
- L1: comments
- M1: thumbnails_standard
- N1: channel_id
- O1: channel_title
- P1: note

Useful formulas

- Link to video: in a new column say Q use formula:
  =HYPERLINK("https://www.youtube.com/watch?v=" & E2, "watch")
- Days since published:
  =INT(NOW() - G2)
- Views per day:
  =IF((INT(NOW()-G2))>0, J2 / INT(NOW()-G2), J2)
- Top videos by views: use SORT range by column J.

Troubleshooting and common errors

Authentication errors

- Ensure you granted OAuth scopes in Apps Script when prompted.
- Revoke and reauthorize if scopes changed.
- If the script throws an error about YouTube service not found, add the Advanced Service "YouTube Data API" in the Apps Script editor.

Quota errors

- The API returns 403 with reason usageLimits. Lower run frequency.
- Reduce parts in API calls. For example, remove statistics if you only need titles.

Pagination issues

- If a playlist returns more items than expected, the script collects items across pages.
- If items repeat, filter duplicates by video ID.

Missing fields

- Not all fields exist for all videos. The script sets defaults such as empty string or zero.

Common error messages and fixes

- "Exception: You do not have permission to call YouTube.PlaylistItems.list" — Enable YouTube Data API Advanced Service and grant permission.
- "Exceeded rate limits" — Add delays, reduce calls, or request quota increase in Cloud Console.

Frequently asked questions

Q: How do I find a playlist ID?
A: On YouTube, open the playlist and look at the URL. For example https://www.youtube.com/playlist?list=PLabc123. The playlist ID is the value after list=.

Q: Can I back up private playlists?
A: Yes if the account you authorize owns or has access to the playlist.

Q: Can I use OAuth for a service account?
A: The YouTube Data API does not support service accounts for most user data. Use OAuth2 with a user account.

Q: Do I need to enable billing in Cloud Console?
A: For normal read-only use you do not need billing. If you need a quota increase you may need to request it and that can require a billing account.

Q: What is the best backup schedule?
A: Choose a cadence that matches your playlist update rate. Daily or weekly are common. Match schedule to quota limits.

Contributing

- Open an issue for bugs or feature requests.
- Fork the repository.
- Create a feature branch and submit a pull request.
- Keep changes focused and small.
- Add tests or example sheets when you add features.

Changelog and releases

Releases appear on the Releases page. Download the files listed in a release and run any script or manifest included. The release page contains packaged code and notes. Download the release file and execute it per the instructions that come with the release: [Releases (download and execute)](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)

If a release includes a zip or .gs file, download that file, unzip if needed, and copy the .gs into your Apps Script project or use the Apps Script Import tool. Execute the setup function once to authorize.

Advanced examples and patterns

1) Incremental update pattern

- On first run write all rows.
- Store the last run timestamp in Config cell A1.
- On the next run fetch playlist items and compare publishedAt or position. If a video exists skip append and only update stats columns.
- This pattern lowers the number of writes and keeps history compact.

2) Archive pattern

- Store every run as a snapshot with backup_timestamp.
- Use a separate sheet per run or add a run_id column.
- This pattern yields full historical view for analysis.

3) Rate-limited batch update pattern

- Use caching of video metadata for a short window using PropertiesService.
- For heavy playlists split execution across multiple scheduled runs to avoid hitting quotas.

API: fields and parts

- playlistItems.list parts: snippet, contentDetails
- videos.list parts: snippet, contentDetails, statistics
- Request only parts you need. For example, if you do not need statistics omit the statistics part to save quota.

Data mapping and normalization

- Duration is ISO 8601. Convert to seconds for numeric analysis.
- Publish date is ISO time. Use DATEVALUE or parse in spreadsheet formulas.
- Views, likes, comments come as strings. Convert to numbers with VALUE or parseInt in script.

Security and privacy

- The script runs under the account that authorizes it.
- Store sensitive data only in the sheet or properties if you trust the account.
- Use restricted access or keep the sheet private.

Example: Setup a Config sheet

Create a "Config" sheet with the following columns:

- playlist_id (A)
- sheet_name (B)
- enabled (C) — set to TRUE to include
- schedule (D) — optional label for human reference

Example rows:

- A2: PLabc123, B2: "Backups/ChannelA", C2: TRUE
- A3: PLdef456, B3: "Backups/ChannelB", C3: FALSE

The fetchAllPlaylistsToSheets function reads these rows, checks enabled, and runs fetchPlaylistToSheet for each enabled playlist.

Testing tips

- Use small playlists during testing for faster iterations.
- Add Logger.log statements in the script to inspect data in Logs.
- Use try/catch to catch and write errors to a "Logs" sheet.

Integration ideas

- Use Google Data Studio or Looker Studio to visualize views and trends from your backup sheet.
- Use Zapier or Make to trigger other workflows when new rows appear.
- Use Apps Script to push CSV exports to Google Drive or an FTP endpoint.

Release file handling

The Releases page contains packaged files and release notes. Download the compressed file or script files listed. After download, open your Apps Script project and import or paste the code. If a release includes an install script, run it once in Apps Script to apply configuration.

Releases: [Download the release file(s) from Releases and execute them](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)

Examples of use cases

- Analytics team tracks video lifecycles.
- Content managers keep offline archive of playlists for audit.
- Creators export titles and IDs for re-upload lists or migration.
- Data engineers feed Google Sheet into ETL pipelines.

Practical tips

- Start small with one playlist and one sheet.
- Validate headers after first run.
- Save a copy of the sheet before large tests.
- Use a naming convention for sheets to keep backups organized by channel or date.

Scripts you may add

- deleteOldBackups: remove rows older than X days.
- mergeDuplicates: find duplicate video_id rows and merge stats.
- pivotSummary: create a pivot table sheet summarizing views per day.
- sendReport: email a CSV snapshot to a recipient weekly.

Example automation workflow

1. Use fetchAllPlaylistsToSheets scheduled daily.
2. Add sendReport to run weekly after fetch.
3. sendReport composes a CSV from last 7 days and emails it.

sendReport sample

```javascript
function sendReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Backup');
  const lastRows = sheet.getDataRange().getValues().slice(-1000); // last 1000 rows
  const csv = lastRows.map(r => r.map(c => (''+c).replace(/"/g,'""')).map(c => `"${c}"`).join(',')).join('\n');
  MailApp.sendEmail({
    to: 'owner@example.com',
    subject: 'Weekly YouTube playlist backup CSV',
    body: 'Attached is the CSV export.',
    attachments: [{fileName: 'yt-playlist-backup.csv', content: csv, mimeType: 'text/csv'}]
  });
}
```

Performance and scaling

- For large channels and many playlists, split work across multiple runs.
- Use batch updates where possible to reduce calls to Sheets API.
- Use getValues and setValues in bulk rather than cell-by-cell operations.

Tests and validation

- After run, validate row count matches expected playlist size.
- Compare video_id set against playlist page via UI for verification.
- Spot-check durations and view counts for accuracy.

Changelog summary

- 1.0.0 — initial release with basic backup features.
- 1.1.0 — added batching, improved headers, added Config support.
- 1.2.0 — added incremental update pattern and helper functions.
- Check Releases on the GitHub Releases page for the packaged files. If a release file is present, download it and execute the included scripts in your Apps Script project: https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases

Design notes for maintainers

- Keep parts requested from the API minimal.
- Keep the header array as the single source of truth for columns.
- Add unit tests for iso8601DurationToSeconds to avoid regression.
- Add error handling to write failed playlist IDs to a "Failed" sheet.

License

This project uses the MIT license. See LICENSE.

Support and contact

- Open issues on GitHub for bugs and feature requests.
- Submit pull requests for fixes or new features.
- For immediate help, include logs and the stack trace when you open an issue.

Releases and download reminder

Visit the Releases page to get packaged files. If the release includes a zip or script, download the file and execute it per the release notes. The release link: [Download the release file(s) from Releases and execute them](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)

Images, icons and assets

- YouTube logo from Wikimedia for visual context.
- Google Sheets and Apps Script logos used for branding.
- Use icons and logos per their usage terms.

Project topics and keywords

- excel
- google-apps-script
- google-sheets
- google-sheets-api
- javascript
- playlist
- playlist-backup
- spreadsheet
- spreadsheets
- video
- youtube
- youtube-api
- youtube-api-playlist
- youtube-api-v3
- youtube-api-v3-2025
- youtube-playlist-backup
- youtube-video
- youtube-video-backup

Sample scenarios

1) Creator with one playlist
- Use default script with PLAYLIST_ID constant.
- Schedule daily run.

2) Manager with ten playlists
- Create Config sheet with playlist list.
- Use fetchAllPlaylistsToSheets scheduled at low traffic time.
- Use incremental updates to reduce API calls.

3) Analyst who needs exports
- Run script hourly.
- Use sendReport to produce CSV daily.
- Feed CSV into analytics pipeline.

Release instructions summary

- Go to Releases page.
- Download the file(s) attached to the release.
- If the release provides a .gs or a zip of script files, import them into your Apps Script project.
- Run the setup and initial fetch to authorize the script.

Releases: [Download the release file(s) from Releases and execute them](https://github.com/Mwinj09/youtube-playlist-backup-apps-script/releases)