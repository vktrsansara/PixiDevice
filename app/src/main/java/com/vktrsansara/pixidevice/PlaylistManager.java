package com.vktrsansara.pixidevice;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import androidx.annotation.Nullable;

public class PlaylistManager {
    private static final String TAG = "PlaylistManager";
    private final Activity activity;
    private final WebView webView;
    private static final int PICK_PLAYLIST_REQUEST = 1003;

    public PlaylistManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void savePlaylist(String filename, String jsonData) {
        new Thread(() -> {
            try {
                String finalFilename = filename;
                if (!finalFilename.toLowerCase().endsWith(".json")) {
                    finalFilename += ".json";
                }

                File docDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
                File pixiDir = new File(docDir, "PixiDevice/Playlist");
                if (!pixiDir.exists()) {
                    if (!pixiDir.mkdirs()) {
                        Log.e(TAG, "Failed to create directory: " + pixiDir.getAbsolutePath());
                        notifySaveResult(false, "Не удалось создать папку");
                        return;
                    }
                }

                File file = new File(pixiDir, finalFilename);
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    fos.write(jsonData.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }
                
                Log.d(TAG, "Playlist saved to: " + file.getAbsolutePath());
                notifySaveResult(true, "Файл сохранен");
            } catch (Exception e) {
                Log.e(TAG, "Error saving playlist", e);
                notifySaveResult(false, "Ошибка при сохранении: " + e.getMessage());
            }
        }).start();
    }

    @JavascriptInterface
    public void pickPlaylist() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("application/json");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        activity.startActivityForResult(Intent.createChooser(intent, "Select Playlist"), PICK_PLAYLIST_REQUEST);
    }

    public void handleResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == PICK_PLAYLIST_REQUEST && resultCode == Activity.RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null) {
                new Thread(() -> {
                    try {
                        InputStream is = activity.getContentResolver().openInputStream(uri);
                        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line);
                        }
                        reader.close();
                        is.close();
                        notifyPlaylistLoaded(sb.toString());
                    } catch (Exception e) {
                        Log.e(TAG, "Error reading playlist", e);
                    }
                }).start();
            }
        }
    }

    private void notifySaveResult(boolean success, String message) {
        activity.runOnUiThread(() -> {
            String escapedMessage = message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
            String successStr = success ? "true" : "false";
            String script = "window.dispatchEvent(new CustomEvent('playlist:save_result', {detail: {success: " + successStr + ", message: '" + escapedMessage + "'}}));";
            webView.evaluateJavascript(script, null);
        });
    }

    private void notifyPlaylistLoaded(String json) {
        activity.runOnUiThread(() -> {
            // Need to properly escape JSON for JS injection
            String escapedJson = json.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "").replace("\r", "");
            String script = "window.dispatchEvent(new CustomEvent('playlist:loaded', {detail: {json: '" + escapedJson + "'}}));";
            webView.evaluateJavascript(script, null);
        });
    }
}
