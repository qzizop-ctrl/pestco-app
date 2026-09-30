package com.pestco.app;

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
