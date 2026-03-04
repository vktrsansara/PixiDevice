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
import android.view.View;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowCompat;
import android.content.Intent;
import androidx.annotation.Nullable;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;
    private NsdHelper nsdHelper;
    private ImageManager imageManager;

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
        
        myWebView.loadUrl("file:///android_asset/index.html");

        // Initialize NSD Helper and inject JS Interface
        nsdHelper = new NsdHelper(this, myWebView);
        myWebView.addJavascriptInterface(nsdHelper, "AndroidDiscovery");

        // Initialize Image Manager and inject JS Interface
        imageManager = new ImageManager(this, myWebView);
        myWebView.addJavascriptInterface(imageManager, "AndroidImage");

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
        if (imageManager != null) {
            imageManager.handleResult(requestCode, resultCode, data);
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