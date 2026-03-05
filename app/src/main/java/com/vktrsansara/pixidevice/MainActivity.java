package com.vktrsansara.pixidevice;

import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.net.Uri;
import android.view.View;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowCompat;
import android.content.Intent;
import androidx.annotation.Nullable;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;
    private NsdHelper nsdHelper;
    private ImageManager imageManager;
    private MusicManager musicManager;
    private ValueCallback<Uri[]> filePathCallback;
    private static final int FILE_CHOOSER_RESULT_CODE = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        
        myWebView = (WebView) findViewById(R.id.webview);
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        
        // Ensure links open within the WebView
        myWebView.setWebViewClient(new WebViewClient());
        
        // Handle file chooser (input type="file")
        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                           FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
                return true;
            }
        });
        
        myWebView.loadUrl("file:///android_asset/index.html");

        // Initialize NSD Helper and inject JS Interface
        nsdHelper = new NsdHelper(this, myWebView);
        myWebView.addJavascriptInterface(nsdHelper, "AndroidDiscovery");

        // Initialize Image Manager and inject JS Interface
        imageManager = new ImageManager(this, myWebView);
        myWebView.addJavascriptInterface(imageManager, "AndroidImage");

        // Initialize Music Manager and inject JS Interface
        musicManager = new MusicManager(this, myWebView);
        myWebView.addJavascriptInterface(musicManager, "AndroidMusic");

        // Hide system bars for immersive fullscreen
        WindowInsetsControllerCompat windowInsetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        windowInsetsController.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        windowInsetsController.hide(WindowInsetsCompat.Type.systemBars());

        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            return insets; // Do not apply padding if we want true fullscreen
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        }
        if (imageManager != null) {
            imageManager.handleResult(requestCode, resultCode, data);
        }
        if (musicManager != null) {
            musicManager.handleResult(requestCode, resultCode, data);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (nsdHelper != null) {
            nsdHelper.stopDiscovery();
        }
    }
}