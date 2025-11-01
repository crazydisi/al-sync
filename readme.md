# al-sync

Watch local files and automatically upload them to Adventure Land code slots on save.

This small tool watches one or more local files and POSTs them to Adventure Land's `save_code` API using the same "arguments"-style payload captured from the browser. It verifies the upload by attempting to read back the code from the server.

## Quick summary

- Language: Node.js (ES modules)
- Node: 18+ recommended (undici + ESM)
- Entry point: `al-sync.js`
- Example config: `al-sync.config.json.example`

## Features

- Watch local source files and upload to a given Adventure Land slot on change
- Optional verify step to compare server code to local file
- Debounce and retry logic for robust uploading

## Requirements

- Node.js 18 or newer
- npm

## Install

Open a terminal in the `al-sync` folder and install dependencies:

```powershell
npm ci
```

## Configuration

There are two configuration pieces:

1. `al-sync.config.json` — mapping of local files to Adventure Land slots (copy the example)
2. `.env` — environment variables (contains your `AL_AUTH` cookie value)

Copy the example config into place:

```powershell
Copy-Item .\al-sync.config.json.example .\al-sync.config.json
```

`al-sync.config.json` example structure (already provided in `al-sync.config.json.example`):

```json
{
  "mappings": [
    {
      "file": "/absolute/or/relative/path/to/ranger.js",
      "name": "ranger",
      "slot": 1
    }
  ],
  "debounceMs": 150,
  "concurrency": 1
}
```

- `mappings`: array of objects with `file` (absolute or relative to project root), `name` (human name), and `slot` (slot number used when saving/loading).
- `debounceMs`: milliseconds to debounce rapid file writes (default 150).
- `concurrency`: reserved for future use (not currently used by the main script).

### .env (auth)

The tool uses the Adventure Land auth cookie value (the `auth` cookie). Create a `.env` file in the `al-sync` folder and add the `AL_AUTH` variable:

```text
AL_AUTH=your_auth_cookie_value_here
# Optional overrides
# AL_BASE=https://adventure.land
# AL_SAVE_PATH=/api/save_code
# AL_VERIFY_PATH=/api/load_code
```

How to obtain the `auth` cookie value:

1. Open [https://adventure.land](https://adventure.land) in your browser and make sure you're logged in.
2. Open DevTools → Console.
3. Paste the snippet below and press Enter. It prints all cookies as JSON — find the object with `name: "auth"` and copy the `value` field.

```javascript
(function() {
  const cookies = document.cookie.split('; ').map(c => {
    const [name, ...v] = c.split('=');
    return { name, value: v.join('='), domain: '.adventure.land', path: '/' };
  });
  console.log(JSON.stringify(cookies, null, 2));
})();
```

Security note: treat this value like a password. Do not commit `.env` or your cookie into source control.

## Running

There are two common modes:

- Watch mode (default): keeps watching and uploads on changes
- Once mode: upload all mapped files once and exit

Use npm scripts or run node directly.

Watch mode:

```powershell
npm start
# or
node .\al-sync.js
```

Once (one-shot) mode:

```powershell
npm run once
# or
node .\al-sync.js --once
```

If you prefer to set the auth token temporarily without a `.env` file on PowerShell:

```powershell
#$env:AL_AUTH = "your_auth_value"
node .\al-sync.js
```

## What the script does

- Reads `al-sync.config.json` for mappings
- Uses `chokidar` to watch local files
- When a file changes, it reads the file and computes a SHA-256 hash
- If content changed, it POSTs to `${AL_BASE}${AL_SAVE_PATH}` (`/api/save_code` by default) with the browser-like `method=save_code` and `arguments` form fields
- It retries uploads (p-retry) and attempts to verify by calling `load_code` to compare server code

## Environment variables

- `AL_AUTH` (required) — the `auth` cookie value from Adventure Land
- `AL_BASE` (optional) — base URL, defaults to `https://adventure.land`
- `AL_SAVE_PATH` (optional) — path for save (default `/api/save_code`)
- `AL_VERIFY_PATH` (optional) — path for verify/load (default `/api/load_code`)

## Troubleshooting

- If you see `AL_AUTH missing` or a fatal error, make sure `.env` exists and contains `AL_AUTH`. Restart the script after editing `.env`.
- If uploads fail with HTTP errors, confirm your cookie is valid and hasn't expired.
- If verify returns `differences`, it may be due to server-side normalization of code or a failed upload — inspect logs printed by the script.
- Use `--once` to quickly test a single upload attempt.

## Notes & limitations

- The script sets a request header `cookie: auth=...` to emulate your browser session; it does not store other cookies or headers.
- Keep your cookie secret. Prefer temporary, short-lived browser sessions or dedicated accounts.
- The `concurrency` field in the config is not used by the script currently.

## Example workflow

1. Copy config example and edit `al-sync.config.json` to point at your local script file(s).
2. Create `.env` and set `AL_AUTH`.
3. Run `npm start` and edit the local file — it will upload automatically.

## Acknowledgements

Built to mimic the Adventure Land in-browser save/load payload so you can iterate locally and push code to your slots quickly.

---
If you spot errors, have improvements, or want to add content, please open a merge request — contributions are welcome to help improve this project.