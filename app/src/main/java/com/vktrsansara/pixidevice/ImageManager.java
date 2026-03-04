package com.vktrsansara.pixidevice;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.net.Uri;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.List;

import androidx.annotation.Nullable;

public class ImageManager {
    private static final String TAG = "ImageManager";
    private final Activity activity;
    private final WebView webView;
    private String targetIp;
    private int targetHeight;

    public ImageManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void pickImages(String ip, int height) {
        this.targetIp = ip;
        this.targetHeight = height;
        
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        activity.startActivityForResult(Intent.createChooser(intent, "Select Images"), 1001);
    }

    public void handleResult(int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == 1001 && resultCode == Activity.RESULT_OK && data != null) {
            new Thread(() -> {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    for (int i = 0; i < count; i++) {
                        processAndUpload(data.getClipData().getItemAt(i).getUri(), i + 1, count);
                    }
                } else if (data.getData() != null) {
                    processAndUpload(data.getData(), 1, 1);
                }
            }).start();
        }
    }

    private void processAndUpload(Uri uri, int current, int total) {
        try {
            Log.d(TAG, "Processing image " + current + "/" + total + ": " + uri);
            InputStream is = activity.getContentResolver().openInputStream(uri);
            Bitmap original = BitmapFactory.decodeStream(is);
            if (original == null) return;

            // Resize maintaining aspect ratio
            float scale = (float) targetHeight / original.getHeight();
            int targetWidth = Math.round(original.getWidth() * scale);
            
            // Limit width to something reasonable for ESP8266 if needed, but keeping proportions as requested
            Bitmap resized = Bitmap.createScaledBitmap(original, targetWidth, targetHeight, true);
            
            byte[] bmpData = convertTo24BitBmp(resized);
            String filename = "img_" + System.currentTimeMillis() % 10000 + ".bmp";
            
            uploadFile(bmpData, filename, current, total);
            
            original.recycle();
            resized.recycle();
        } catch (Exception e) {
            Log.e(TAG, "Error processing image", e);
        }
    }

    private byte[] convertTo24BitBmp(Bitmap bitmap) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        
        int rowSize = ((width * 24 + 31) / 32) * 4;
        int imageSize = rowSize * height;
        int fileSize = 54 + imageSize;

        ByteBuffer buffer = ByteBuffer.allocate(fileSize);
        buffer.order(ByteOrder.LITTLE_ENDIAN);

        // File Header
        buffer.put((byte) 'B');
        buffer.put((byte) 'M');
        buffer.putInt(fileSize);
        buffer.putInt(0); // Reserved
        buffer.putInt(54); // Offset

        // DIB Header
        buffer.putInt(40); // Size
        buffer.putInt(width);
        buffer.putInt(height); // Positive height for bottom-to-top
        buffer.putShort((short) 1); // Planes
        buffer.putShort((short) 24); // Bits per pixel
        buffer.putInt(0); // Compression (RGB)
        buffer.putInt(imageSize);
        buffer.putInt(2835); // X ppm
        buffer.putInt(2835); // Y ppm
        buffer.putInt(0); // Colors
        buffer.putInt(0); // Important colors

        // Pixel Data (Bottom-to-Top, BGR)
        for (int y = height - 1; y >= 0; y--) {
            for (int x = 0; x < width; x++) {
                int pixel = bitmap.getPixel(x, y);
                buffer.put((byte) (pixel & 0xFF));        // Blue
                buffer.put((byte) ((pixel >> 8) & 0xFF));  // Green
                buffer.put((byte) ((pixel >> 16) & 0xFF)); // Red
            }
            // Padding
            for (int p = 0; p < rowSize - (width * 3); p++) {
                buffer.put((byte) 0);
            }
        }

        return buffer.array();
    }

    private void uploadFile(byte[] data, String filename, int current, int total) {
        String boundary = "Boundary-" + System.currentTimeMillis();
        HttpURLConnection conn = null;
        try {
            URL url = new URL("http://" + targetIp + "/upload");
            conn = (HttpURLConnection) url.openConnection();
            conn.setDoOutput(true);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            
            OutputStream os = conn.getOutputStream();
            DataOutputStream dos = new DataOutputStream(os);

            dos.writeBytes("--" + boundary + "\r\n");
            dos.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n");
            dos.writeBytes("Content-Type: image/bmp\r\n\r\n");
            
            // Write data in chunks for progress (if multiple files, this is just one file)
            // But we can report per-file progress or overall. Let's do cumulative.
            dos.write(data);
            
            dos.writeBytes("\r\n--" + boundary + "--\r\n");
            dos.flush();
            dos.close();

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "Upload response: " + responseCode);
            
            final float progress = ((float) current / total) * 100;
            sendProgressToWeb(progress);

        } catch (Exception e) {
            Log.e(TAG, "Upload failed", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private void sendProgressToWeb(float percent) {
        webView.post(() -> {
            String script = String.format("window.dispatchEvent(new CustomEvent('upload:progress', {detail: %f}));", percent);
            webView.evaluateJavascript(script, null);
        });
    }
}
