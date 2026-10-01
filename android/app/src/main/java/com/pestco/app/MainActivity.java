package com.pestco.app;

import android.content.SharedPreferences;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String PREFS = "pestco_webview";
    private static final String KEY_LAST_UPDATE = "last_update_time";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StorageAccessPlugin.class);
        registerPlugin(WhatsAppPlugin.class);
        super.onCreate(savedInstanceState);

        clearWebViewCacheIfAppWasUpdated();
    }

    // Capacitor serves the app's own files (index.html, its JS/CSS) from a
    // fixed local URL. Android's WebView caches those like any website, so
    // after installing an updated build over an older one it could keep
    // serving a stale cached index.html instead of what is actually in the
    // new APK (force-clearing the app's storage used to be the only fix).
    //
    // This used to clear the cache AND disable it (LOAD_NO_CACHE) on EVERY
    // launch, which also forced every network resource the WebView loads
    // (e.g. the Tajawal font from Google Fonts) to be re-downloaded each
    // time. Now the cache is cleared only when the installed build changed
    // (PackageInfo.lastUpdateTime moves on every install/update, even when
    // versionCode does not), and the normal cache behaviour stays on.
    private void clearWebViewCacheIfAppWasUpdated() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;

            long lastUpdate = getPackageManager()
                .getPackageInfo(getPackageName(), 0).lastUpdateTime;
            SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

            if (prefs.getLong(KEY_LAST_UPDATE, -1L) != lastUpdate) {
                getBridge().getWebView().clearCache(true);
                prefs.edit().putLong(KEY_LAST_UPDATE, lastUpdate).apply();
            }
        } catch (Exception ignored) {
            // Never block startup over cache housekeeping.
        }
    }
}
