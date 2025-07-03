## Sample Importer

This project is mostly GPT generated and is intended for a private usage.

---

### 0  |  Purpose

Automate the transfer of plain-text result files (\*.txt, ≤ 5 KB) from an on-prem SMB share to a Google Sheets workbook (“Released Samples”).
The flow is fully unattended:

```
SMB share  ──Watcher (PowerShell)──►  Google Apps Script Web-App  ──►  Sheet rows
```

---

### 1  |  Client-side components (Windows PC)

| File / Folder (under user profile)                                              | Purpose                                                                                                                       | Notes                                                                                   |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **`%USERPROFILE%\SampleWatcher\SampleWatcher.ps1`**                             | **Watcher script**. Monitors the share, sends new files to Google, persists progress in *state.json*.                         | Edit constants at the top only. Contains OAuth handling, dedup logic, and timed rescan. |
| **`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SampleWatcher.vbs`** | Invisible launcher. Ensures exactly **one** watcher instance is running and sets working directory to *SampleWatcher* folder. | Creates *launcher.log* in the same folder for any startup errors.                       |

#### How it starts

* Windows runs *SampleWatcher.vbs* at every log-on (Startup folder).
* The VBS checks for a running **powershell.exe … SampleWatcher.ps1**; if found it exits silently.
* Otherwise it launches PowerShell **hidden** (`WindowStyle 0`).

You also need to install google cloud CLI. You can do so by running the following command in PowerShell:

```powershell
(New-Object Net.WebClient).DownloadFile(
  'https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe',
  "$env:TEMP\GoogleCloudSDKInstaller.exe")
& "$env:TEMP\GoogleCloudSDKInstaller.exe" /noreporting /quiet /singleuser
```

No need to configure google cloud CLI. The watcher script will handle the authentication automatically.

---

### 2  |  Server-side components (bound to the Google Sheet)

| Script file           | Role                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **Config.gs**         | Constants: `INBOUND_TOKEN`, model → product map, default sheet name, property key name.    |
| **WebApp.gs**         | Web-App endpoint (`doPost`), TXT parser, dedup with script properties, row append.         |
| **MenuAndConfig.gs**  | Adds **Sample Importer** menu, config sidebar, processed-list dialog, docs sidebar.        |
| **ConfigUI.html**     | Sidebar UI to edit sheet name, property key, model map (inputs disabled until data loads). |
| **Docs.html**         | In-sheet documentation pane (“Documentation” menu item).                                   |
| **ManualImport.html** | Dialog to let a user browse a local file and push it through the same parser.              |

Deployment steps (once):

1. Open the bound Sheet → **Extensions ▸ Apps Script**.
2. Paste / save all files above.
3. **Deploy ▸ Web App**

    * *Execute as*: **Me**
    * *Who has access*: **Anyone in X** (company restriction)
4. Copy the Web-App URL – it is `$WebAppUrl` in the watcher script.

---

### 3  |  End-to-end flow

1. **Watcher** wakes every 10 min (and on share events).
2. New file → base-64 + JSON POST to `WebAppUrl` with `INBOUND_TOKEN`.
3. **Apps Script** authenticates the token, skips duplicates, parses key lines, looks up Product, and appends a row:

---

### 4  |  Security & Auth

* **Between PC and Google** – HTTPS; bearer token from `gcloud auth print-access-token`.
* **Deduplication** – server-side script properties **and** client-side *state.json*.
* **Network scope** – Web-App restricted to company accounts; token required.
* **Local rights** – watcher runs under the standard user, no admin needed.

---

### 5  |  First-time installation checklist

1. Create folder **`%USERPROFILE%\SampleWatcher`**; put **SampleWatcher.ps1** there.
2. Edit its constants (`$SharePath`, `$WebAppUrl`, `$SecretToken`).
3. Run the script once manually:

   ```powershell
   cd $env:USERPROFILE\SampleWatcher
   powershell -ExecutionPolicy Bypass -File .\SampleWatcher.ps1
   ```

   *Browser opens → sign in → Drive access granted.*
4. Confirm *state.json* created and “Success” lines appear.
5. Place **SampleWatcher.vbs** in **Startup** folder.
6. Log off / on → run

   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='powershell.exe' AND CommandLine LIKE '%SampleWatcher.ps1%'" |
       Select ProcessId, StartTime
   ```

   to verify exactly one hidden watcher.

---

### 6  |  Troubleshooting quick table

| Symptom                           | Where to look                                                              |
| --------------------------------- | -------------------------------------------------------------------------- |
| Browser pops up asking to sign in | Token expired; user must complete the OAuth flow once.                     |
| Duplicate uploads                 | Ensure `state.json` is not deleted; check Apps Script processed-file list. |
| Multiple watcher instances        | Mutex block in `.ps1`, VBS singleton check, kill stray PowerShells.        |
| Powershell window visible         | Make sure you run via VBS (not `.ps1` directly) and window style is `0`.   |

---

### 7  |  File‐location cheat-sheet

```
└─ %USERPROFILE%
   ├─ SampleWatcher
   │  ├─ SampleWatcher.ps1
   │  ├─ state.json
   │  └─ watcher.log          (optional transcript)
   └─ AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
      └─ SampleWatcher.vbs    (invisible launcher)
```

Sheet-bound Apps Script files live only inside the Google Sheets project.

---

**That’s everything** – from folder watcher to in-sheet UI, with single-click
setup for end users and clear hooks for IT to audit or disable.
