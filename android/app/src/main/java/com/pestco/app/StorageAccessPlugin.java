package com.pestco.app;

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
