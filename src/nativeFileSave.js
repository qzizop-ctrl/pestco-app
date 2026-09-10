// ============================================================================
// Native file saving for the Android/iOS packaged app and the web fallback.
// On Android 11+ the app can optionally request Android's special
// "All files access" permission so generated PDF/Excel files can be written
// directly to the public Download folder. This is a special Android setting,
// not a normal runtime permission.
// ============================================================================

import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";

const StorageAccess = registerPlugin("StorageAccess");

async function ensureAndroidAllFilesAccess() {
  if (Capacitor.getPlatform() !== "android") return false;

  try {
    const status = await StorageAccess.checkAllFilesAccess();
    if (status?.granted) return true;

    // Opens Android Settings > Special app access > All files access.
    await StorageAccess.requestAllFilesAccess();

    // The native method returns before the user finishes in Settings. Wait for
    // the app to become active again, then check the setting one more time.
    return await new Promise(async (resolve) => {
      let settled = false;
      let listener;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (listener) listener.remove();
        resolve(value);
      };

      const timeout = setTimeout(() => finish(false), 5 * 60 * 1000);
      listener = await App.addListener("appStateChange", async ({ isActive }) => {
        if (!isActive) return;
        clearTimeout(timeout);
        try {
          const after = await StorageAccess.checkAllFilesAccess();
          finish(!!after?.granted);
        } catch {
          finish(false);
        }
      });
    });
  } catch (e) {
    // The native plugin is only present in the patched Android project.
    // Falling through keeps the normal share/save sheet available.
    return false;
  }
}

// data must be a raw base64 string (no "data:...;base64," prefix).
// Returns { uri, savedToDownloads }.
export async function saveFileNative(fileName, base64Data) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  if (Capacitor.getPlatform() === "android") {
    try {
      const hasAllFilesAccess = await ensureAndroidAllFilesAccess();

      if (hasAllFilesAccess) {
        const written = await Filesystem.writeFile({
          path: `Download/${fileName}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        return { uri: written.uri, savedToDownloads: true };
      }

      // Android 9 and older can still use the Filesystem public-storage
      // permission model. Keep this compatibility path for older devices.
      const perm = await Filesystem.checkPermissions();
      const granted = perm.publicStorage === "granted"
        ? perm
        : await Filesystem.requestPermissions();

      if (granted.publicStorage === "granted") {
        const written = await Filesystem.writeFile({
          path: `Download/${fileName}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        return { uri: written.uri, savedToDownloads: true };
      }
    } catch (e) {
      // If Android blocks direct public storage, use the OS share/save sheet.
    }
  }

  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Cache,
  });

  try {
    await Share.share({ title: fileName, url: written.uri });
  } catch (e) {
    // The file was still created in cache; this only means the share sheet
    // was dismissed or unavailable.
  }

  return { uri: written.uri, savedToDownloads: false };
}
