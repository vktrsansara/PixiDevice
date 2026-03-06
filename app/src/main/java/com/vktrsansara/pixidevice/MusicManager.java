package com.vktrsansara.pixidevice;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

import androidx.annotation.Nullable;

public class MusicManager {
    private static final String TAG = "MusicManager";
    private final Activity activity;
    private final WebView webView;
    private static final String TRACK_FILENAME = "last_track.mp3";
    private static final int PICK_AUDIO_REQUEST = 1002;

    public MusicManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void pickAudio() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("audio/*");
        activity.startActivityForResult(Intent.createChooser(intent, "Select Audio Track"), PICK_AUDIO_REQUEST);
    }

    @JavascriptInterface
    public String getLastTrackPath() {
        File file = new File(activity.getFilesDir(), TRACK_FILENAME);
        if (file.exists()) {
            return "file://" + file.getAbsolutePath();
        }
        return null;
    }

    public void handleResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == PICK_AUDIO_REQUEST && resultCode == Activity.RESULT_OK && data != null) {
            Uri uri = data.getData();
            if (uri != null) {
                new Thread(() -> {
                    if (copyToInternalStorage(uri)) {
                        notifyTrackLoaded(getFileName(uri));
                    }
                }).start();
            }
        }
    }

    private boolean copyToInternalStorage(Uri uri) {
        try {
            InputStream is = activity.getContentResolver().openInputStream(uri);
            File outFile = new File(activity.getFilesDir(), TRACK_FILENAME);
            OutputStream os = new FileOutputStream(outFile);

            byte[] buffer = new byte[1024 * 8];
            int read;
            while ((read = is.read(buffer)) != -1) {
                os.write(buffer, 0, read);
            }
            os.flush();
            os.close();
            is.close();
            Log.d(TAG, "Audio copied to: " + outFile.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Error copying audio", e);
            return false;
        }
    }

    private String getFileName(Uri uri) {
        String result = null;
        if (uri.getScheme().equals("content")) {
            try (Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (index != -1) {
                        result = cursor.getString(index);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error getting filename from content URI", e);
            }
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result.lastIndexOf('/');
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return (result != null && !result.isEmpty()) ? result : "track.mp3";
    }

    private void notifyTrackLoaded(String fileName) {
        webView.post(() -> {
            String script = String.format("window.dispatchEvent(new CustomEvent('audio:loaded', {detail: {name: '%s', url: '%s'}}));", 
                fileName, getLastTrackPath());
            webView.evaluateJavascript(script, null);
        });
    }
}
