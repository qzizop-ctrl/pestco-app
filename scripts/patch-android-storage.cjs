#!/usr/bin/env node
// ============================================================================
// Patches the Capacitor-generated android/ project (created fresh by
// `npx cap add android`) with:
//   - two native plugins: StorageAccess (save-to-Downloads / All-Files-Access
//     permission) and WhatsApp (open a chat, preferring WhatsApp Business)
//   - the AndroidManifest.xml permissions/queries/largeHeap those plugins need
//   - a MainActivity.java that registers both plugins
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

const STORAGE_ACCESS_PLUGIN_JAVA = `package com.pestco.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    @com.getcapacitor.PluginMethod
    public void checkAllFilesAccess(PluginCall call) {
        boolean granted;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            granted = Environment.isExternalStorageManager();
        } else {
            granted = true;
        }

        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @com.getcapacitor.PluginMethod
    public void requestAllFilesAccess(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION
                );
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
            }
            call.resolve();
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Unable to open storage access settings", e2);
            }
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

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StorageAccessPlugin.class);
        registerPlugin(WhatsAppPlugin.class);
        super.onCreate(savedInstanceState);
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

  // 1) MANAGE_EXTERNAL_STORAGE permission, right before <application ...>.
  if (!manifest.includes("android.permission.MANAGE_EXTERNAL_STORAGE")) {
    manifest = manifest.replace(
      /(\s*)(<application)/,
      `$1<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />$1$2`
    );
  }

  // 2) <queries> block for WhatsApp / WhatsApp Business package visibility,
  // also right before <application ...>.
  if (!manifest.includes("com.whatsapp.w4b")) {
    manifest = manifest.replace(
      /(\s*)(<application)/,
      `$1<queries>$1    <package android:name="com.whatsapp.w4b" />$1    <package android:name="com.whatsapp" />$1</queries>$1$2`
    );
  }

  // 3) android:largeHeap="true" on the <application> tag itself.
  if (!manifest.includes('android:largeHeap="true"')) {
    manifest = manifest.replace(
      /<application/,
      `<application\n        android:largeHeap="true"`
    );
  }

  fs.writeFileSync(MANIFEST_PATH, manifest);
}

function writeJavaFiles() {
  fs.mkdirSync(PACKAGE_DIR, { recursive: true });
  fs.writeFileSync(path.join(PACKAGE_DIR, "StorageAccessPlugin.java"), STORAGE_ACCESS_PLUGIN_JAVA);
  fs.writeFileSync(path.join(PACKAGE_DIR, "WhatsAppPlugin.java"), WHATSAPP_PLUGIN_JAVA);
  fs.writeFileSync(path.join(PACKAGE_DIR, "MainActivity.java"), MAIN_ACTIVITY_JAVA);
}

function main() {
  patchManifest();
  writeJavaFiles();
  console.log("Patched AndroidManifest.xml and wrote StorageAccessPlugin.java, WhatsAppPlugin.java, MainActivity.java.");
}

main();
