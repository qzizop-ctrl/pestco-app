#!/usr/bin/env node
// ============================================================================
// Patches the Capacitor-generated android/ project (created fresh by
// `npx cap add android`) with:
//   - two native plugins: StorageAccess (save-to-Downloads) and WhatsApp
//     (open a chat, preferring WhatsApp Business)
//   - the AndroidManifest.xml queries/largeHeap those plugins need
//   - a MainActivity.java that registers both plugins
//   - a real release signingConfig + minification on build.gradle, sourced
//     from CI env vars (see patchBuildGradle() below and build-apk.yml)
//
// This has to run every time android/ is (re)generated, since `cap add
// android` scaffolds a fresh, unpatched project each time — hence it being
// wired into `android:sync` / `android:setup` in package.json rather than
// being a one-off manual edit.
//
// NOTE ON HOW THIS FILE CAME BACK: this exact file was missing from a
// project export (package.json referenced it, but it wasn't in the
// zip/repo snapshot) even though .github/workflows/build-apk.yml still
// worked, because that workflow had its own separate, inlined copy of this
// same patching logic (mkdir + sed + cat heredocs) instead of calling
// `npm run android:patch`. This script was reconstructed from that inlined
// CI copy — byte-for-byte the same Java sources and manifest edits — and
// the workflow was then switched to call this script instead, so there's
// one source of truth going forward instead of two copies that can drift
// apart. If any local behavior differs from what the project had before,
// it's worth diffing against git history for the original file.
//
// Idempotent: safe to run more than once against the same android/
// project (e.g. during iterative local development) — manifest edits are
// skipped if already present, and the Java files are just overwritten
// with the same content.
// ============================================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PACKAGE_DIR = path.join(ROOT, "android", "app", "src", "main", "java", "com", "pestco", "app");
const MANIFEST_PATH = path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml");
const BUILD_GRADLE_PATH = path.join(ROOT, "android", "app", "build.gradle");

const STORAGE_ACCESS_PLUGIN_JAVA = `package com.pestco.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

// NOTE: this plugin deliberately does NOT request
// android.permission.MANAGE_EXTERNAL_STORAGE ("All files access"). That's
// Android's most sensitive storage permission — Play Store review requires
// a separate declaration/justification for it, and it grants far more than
// this app needs. On Android 10+ (Build.VERSION_CODES.Q and up),
// saveToDownloads() below writes through MediaStore, which needs no
// storage permission at all. Only the legacy pre-Android-10 fallback path
// touches the public Downloads folder directly, and that only ever needed
// the (much narrower, and now largely deprecated) WRITE_EXTERNAL_STORAGE
// permission — never MANAGE_EXTERNAL_STORAGE.
@CapacitorPlugin(name = "StorageAccess")
public class StorageAccessPlugin extends Plugin {

    @com.getcapacitor.PluginMethod
    public void saveToDownloads(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (fileName == null || base64Data == null) {
            call.reject("fileName and base64Data are required");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (Exception e) {
            call.reject("Invalid base64Data", e);
            return;
        }

        try {
            String uriString;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();

                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                Uri itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (itemUri == null) {
                    call.reject("Could not create file in Downloads");
                    return;
                }

                OutputStream out = resolver.openOutputStream(itemUri);
                if (out == null) {
                    call.reject("Could not open output stream for Downloads file");
                    return;
                }
                out.write(bytes);
                out.flush();
                out.close();

                uriString = itemUri.toString();

            } else {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_DOWNLOADS
                );
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }

                File outFile = new File(downloadsDir, fileName);
                FileOutputStream fos = new FileOutputStream(outFile);
                fos.write(bytes);
                fos.flush();
                fos.close();

                uriString = Uri.fromFile(outFile).toString();
            }

            JSObject ret = new JSObject();
            ret.put("uri", uriString);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to save file to Downloads", e);
        }
    }
}
`;

const WHATSAPP_PLUGIN_JAVA = `package com.pestco.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

// Opens a WhatsApp chat, preferring WhatsApp Business when it's installed.
// A plain wa.me link/WebView has no way to target one specific app — only
// a real Android Intent with setPackage() can do that, which is why this
// needs to be native code rather than a link. See src/nativeWhatsApp.js.
@CapacitorPlugin(name = "WhatsApp")
public class WhatsAppPlugin extends Plugin {

    private static final String BUSINESS_PACKAGE = "com.whatsapp.w4b";
    private static final String REGULAR_PACKAGE = "com.whatsapp";

    @com.getcapacitor.PluginMethod
    public void open(PluginCall call) {
        String phone = call.getString("phone");
        if (phone == null || phone.isEmpty()) {
            call.reject("phone is required");
            return;
        }

        Uri uri = Uri.parse("https://wa.me/" + phone);
        PackageManager pm = getContext().getPackageManager();

        String targetPackage = null;
        if (isInstalled(pm, BUSINESS_PACKAGE)) {
            targetPackage = BUSINESS_PACKAGE;
        } else if (isInstalled(pm, REGULAR_PACKAGE)) {
            targetPackage = REGULAR_PACKAGE;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            if (targetPackage != null) {
                intent.setPackage(targetPackage);
            }
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open WhatsApp", e);
        }
    }

    private boolean isInstalled(PackageManager pm, String packageName) {
        try {
            pm.getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
`;

const MAIN_ACTIVITY_JAVA = `package com.pestco.app;

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StorageAccessPlugin.class);
        registerPlugin(WhatsAppPlugin.class);
        super.onCreate(savedInstanceState);

        // Capacitor serves the app's own files (index.html, its JS/CSS)
        // from a fixed local URL on every launch. Android's WebView caches
        // that like it would any website, so after installing an updated
        // build over an older one, it could keep serving a stale cached
        // copy of index.html instead of what's actually in the new APK —
        // which is what force-clearing the app's storage from Android
        // Settings used to fix. Clearing the WebView cache on every cold
        // start, and telling it not to trust its cache for this session,
        // makes every launch load whatever build is actually installed,
        // without anyone ever having to clear it by hand again.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
            getBridge().getWebView().getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        }
    }
}
`;

function patchManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(
      `AndroidManifest.xml not found at ${MANIFEST_PATH} — run \`npx cap add android\` (or \`npm run android:add\`) first.`
    );
    process.exit(1);
  }

  let manifest = fs.readFileSync(MANIFEST_PATH, "utf8");

  // Deliberately does NOT add android.permission.MANAGE_EXTERNAL_STORAGE —
  // see the note on StorageAccessPlugin above. If an older patched
  // android/ project still has it from before, remove it too so re-running
  // this script actually cleans it up instead of just never re-adding it.
  manifest = manifest.replace(
    /\s*<uses-permission android:name="android\.permission\.MANAGE_EXTERNAL_STORAGE"\s*\/>/,
    ""
  );

  // 1) <queries> block for WhatsApp / WhatsApp Business package visibility,
  // right before <application ...>.
  if (!manifest.includes("com.whatsapp.w4b")) {
    manifest = manifest.replace(
      /(\s*)(<application)/,
      `$1<queries>$1    <package android:name="com.whatsapp.w4b" />$1    <package android:name="com.whatsapp" />$1</queries>$1$2`
    );
  }

  // 2) android:largeHeap="true" on the <application> tag itself.
  if (!manifest.includes('android:largeHeap="true"')) {
    manifest = manifest.replace(
      /<application/,
      `<application\n        android:largeHeap="true"`
    );
  }

  fs.writeFileSync(MANIFEST_PATH, manifest);
}

// Adds a real release signingConfig (sourced from CI-provided environment
// variables — see .github/workflows/build-apk.yml — never a committed
// keystore/password) and turns minification back on for the release build
// type. Capacitor's scaffolded build.gradle leaves both of those at their
// unsigned/unminified defaults, which is what let build-apk.yml silently
// ship `assembleDebug` output (debug-signed, debuggable, unminified) as a
// public "release" for a long time — that half of the fix is the workflow
// switching to `assembleRelease`; this half is what makes that command
// actually produce something real instead of a build.gradle error.
//
// If the env vars aren't set (e.g. a local `assembleRelease` run with no
// release keystore around), signingConfig is simply left off the release
// buildType — Gradle then fails that build outright rather than silently
// falling back to a debug-signed "release" APK.
function patchBuildGradle() {
  if (!fs.existsSync(BUILD_GRADLE_PATH)) {
    console.error(
      `android/app/build.gradle not found at ${BUILD_GRADLE_PATH} — run \`npx cap add android\` (or \`npm run android:add\`) first.`
    );
    process.exit(1);
  }

  let gradle = fs.readFileSync(BUILD_GRADLE_PATH, "utf8");

  if (!gradle.includes("signingConfigs {")) {
    gradle = gradle.replace(
      /android\s*\{/,
      `android {
    signingConfigs {
        release {
            def ksPath = System.getenv("ANDROID_RELEASE_KEYSTORE_PATH")
            if (ksPath != null && file(ksPath).exists()) {
                storeFile file(ksPath)
                storePassword System.getenv("ANDROID_RELEASE_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_RELEASE_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_RELEASE_KEY_PASSWORD")
            }
        }
    }`
    );
  }

  gradle = gradle.replace(
    /(buildTypes\s*\{\s*release\s*\{)([\s\S]*?)(\n\s*\}\s*\n\s*\})/,
    (fullMatch, head, body, tail) => {
      let newBody = body;
      if (!newBody.includes("signingConfig")) {
        newBody += `
            if (System.getenv("ANDROID_RELEASE_KEYSTORE_PATH") != null) {
                signingConfig signingConfigs.release
            }`;
      }
      newBody = newBody.includes("minifyEnabled")
        ? newBody.replace(/minifyEnabled\s+false/, "minifyEnabled true")
        : `${newBody}\n            minifyEnabled true`;
      if (!newBody.includes("shrinkResources")) {
        newBody += `\n            shrinkResources true`;
      }
      return `${head}${newBody}${tail}`;
    }
  );

  fs.writeFileSync(BUILD_GRADLE_PATH, gradle);
}

function writeJavaFiles() {
  fs.mkdirSync(PACKAGE_DIR, { recursive: true });
  fs.writeFileSync(path.join(PACKAGE_DIR, "StorageAccessPlugin.java"), STORAGE_ACCESS_PLUGIN_JAVA);
  fs.writeFileSync(path.join(PACKAGE_DIR, "WhatsAppPlugin.java"), WHATSAPP_PLUGIN_JAVA);
  fs.writeFileSync(path.join(PACKAGE_DIR, "MainActivity.java"), MAIN_ACTIVITY_JAVA);
}

function main() {
  patchManifest();
  patchBuildGradle();
  writeJavaFiles();
  console.log(
    "Patched AndroidManifest.xml and build.gradle, and wrote StorageAccessPlugin.java, WhatsAppPlugin.java, MainActivity.java."
  );
}

main();
