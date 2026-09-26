// ============================================================================
// Native file saving for the Android/iOS packaged app and the web fallback.
//
// On Android 10+ this writes straight into the public Downloads folder via
// MediaStore (see StorageAccessPlugin.saveToDownloads), which requires no
// storage permission at all — the file just appears in Downloads silently,
// with no settings redirect and no dialog. On Android 9 and older it falls
// back to a direct file write, which needs the legacy WRITE_EXTERNAL_STORAGE
// runtime permission.
//
// If saving straight to Downloads fails for any reason, this falls back to
// writing the file into the app's cache and opening the OS share/save sheet
// so the user can still get the file out manually.
// ============================================================================

import { Capacitor, registerPlugin } from "@capacitor/core";

const StorageAccess = registerPlugin("StorageAccess");

// data must be a raw base64 string (no "data:...;base64," prefix).
// Returns { uri, savedToDownloads }.
export async function saveFileNative(fileName, base64Data, mimeType = "application/pdf") {
  if (Capacitor.getPlatform() === "android") {
    try {
      const result = await StorageAccess.saveToDownloads({
        fileName,
        base64Data,
        mimeType,
      });
      return { uri: result.uri, savedToDownloads: true };
    } catch (e) {
      // Falls through to the cache + share-sheet path below.
    }
  }

  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

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
