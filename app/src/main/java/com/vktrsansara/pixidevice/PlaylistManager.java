package com.vktrsansara.pixidevice;

import android.app.Activity;
import android.webkit.WebView;

import androidx.annotation.Nullable;
import android.content.Intent;

public class PlaylistManager {
    private static final String TAG = "PlaylistManager";
    private final Activity activity;
    private final WebView webView;

    public PlaylistManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public void handleResult(int requestCode, int resultCode, @Nullable Intent data) {
        // Feature "Save/Open Playlist" removed - handles no result.
    }
}
