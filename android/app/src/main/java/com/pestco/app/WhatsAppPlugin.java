package com.pestco.app;

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
