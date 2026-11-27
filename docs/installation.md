# Installation

The extension is not published on the Chrome Web Store. It is installed as an *unpacked extension*, which requires Chrome's **Developer mode**.

> Since Chrome 137, branded Chrome builds ignore the `--load-extension` command-line flag. A script therefore cannot install an unpacked extension silently: the **Load unpacked** click is always manual. The Windows installer automates everything else.

## Windows (installer)

1. Download and unzip `AAI-Report-Installer-vX.Y.Z.zip` (right-click > *Extract All*).
2. Double-click `Installer.bat`.
   If Windows shows *"Windows protected your PC"*, click **More info** then **Run anyway** (the script is not signed).
3. The installer:
   - copies the extension to `%LOCALAPPDATA%\AAIReport\aai-bilan` (a permanent location);
   - puts that path in the clipboard;
   - opens Chrome on `chrome://extensions` and File Explorer on the folder.
4. In Chrome:
   1. Turn on **Developer mode** (top right).
   2. Click **Load unpacked**.
   3. Click the address bar of the folder dialog, paste (`Ctrl+V`), press `Enter`, then **Select Folder**.
5. Pin the extension: puzzle icon in the toolbar, then the pin next to **AAI Instructor Report**.

## Manual install (Windows, macOS, Linux)

1. Unzip `aai-instructor-report-extension-vX.Y.Z.zip` into a folder you will keep (not your Downloads folder if you clear it).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the `aai-bilan` folder (the one that contains `manifest.json`).
4. Pin the extension.

Chrome reads the folder every time it starts: do not delete or move it.

## First run

Reload your *Technical Instructor* page on the AAI portal if it was open before the installation (the content script is only injected into pages loaded after install). The **📊 My AAI report** button appears at the bottom right.

## Updating

- **With the installer:** run the new `Installer.bat`. It overwrites the files in place. Then click the circular **Reload** arrow on the extension card in `chrome://extensions`.
- **Manually:** replace the folder's contents with the new version, then click **Reload** on the extension card.

The extension ID stays the same as long as the folder path does not change, so the last stored report is kept.

## Uninstalling

1. `chrome://extensions` > **Remove** on the *AAI Instructor Report* card.
2. Delete the folder (`%LOCALAPPDATA%\AAIReport` if you used the installer).

## Known warnings

- At startup Chrome may show a banner about extensions in developer mode. This is expected for unpacked extensions; dismiss it.
- On managed (corporate) machines, IT may block Developer mode. See below.

## Corporate deployment

For a one-click install without Developer mode, the extension must be published on the Chrome Web Store, publicly or as *unlisted*. Once published:

- instructors install it with **Add to Chrome** and receive updates automatically;
- IT can force-install it on managed Windows machines with the `ExtensionInstallForcelist` Chrome policy, using the Web Store extension ID.

Publishing requires a Chrome Web Store developer account (one-time registration fee) and a review by Google. The listing will need a description, screenshots (see `docs/images/`, generated from fictional data) and a privacy statement (see [privacy.md](privacy.md)).
