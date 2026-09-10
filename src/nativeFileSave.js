// ============================================================================
// Shared helper for saving generated files (PDF reports, Excel exports) to
// the device when running as the packaged Android app.
//
// Why this isn't a single one-liner: Android's storage rules changed a lot.
// On Android 11+ (API 30+) an app can no longer write straight into the
// public Download/ folder just by holding storage permission — that's
// "scoped storage", and it applies no matter what the user grants. The one
// permission that restores full access (MANAGE_EXTERNAL_STORAGE / "All
// files access") is reviewed and heavily restricted by Google Play and
// isn't appropriate for an app like this one.
//
// So this helper does the best available thing on every version:
//   - Where the OS still allows it (Android 9 and older), it asks for
//     storage permission and writes the file straight into Download/.
//   - Everywhere else (Android 10+, permission denied, or anything else
//     goes wrong), it writes the file to the app's private cache and hands
//     it to the OS share/save sheet, where the user picks "Save to
//     device" / a Files app to place it wherever they want, Downloads
//     included.
// ============================================================================

import { Capacitor } from "@capacitor/core";

// data must be a raw base64 string (no "data:...;base64," prefix).
// Returns { uri, savedToDownloads } — savedToDownloads tells the caller
// whether the file already landed in Download/ or the user still needs to
// pick a destination in the share sheet.
export async function saveFileNative(fileName, base64Data) {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");

  if (Capacitor.getPlatform() === "android") {
    try {
      let perm = await Filesystem.checkPermissions();
      if (perm.publicStorage !== "granted") {
        perm = await Filesystem.requestPermissions();
      }
      if (perm.publicStorage === "granted") {
        const written = await Filesystem.writeFile({
          path: `Download/${fileName}`,
          data: base64Data,
          directory: Directory.ExternalStorage,
          recursive: true,
        });
        return { uri: written.uri, savedToDownloads: true };
      }
    } catch (e) {
      // Expected on Android 11+, where Directory.ExternalStorage throws
      // regardless of permission state. Fall through to the share sheet.
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
    // The file itself was written successfully — this only fails/rejects
    // when the user dismisses the OS share sheet without picking an app.
  }

  return { uri: written.uri, savedToDownloads: false };
}
