package com.vktrsansara.pixidevice;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class NsdHelper {
    private static final String TAG = "NsdHelper";
    private static final String SERVICE_TYPE = "_pixi._tcp.";

    private final NsdManager nsdManager;
    private final WebView webView;
    private NsdManager.DiscoveryListener discoveryListener;
    private final List<NsdServiceInfo> discoveredServices = Collections.synchronizedList(new ArrayList<>());

    public NsdHelper(Context context, WebView webView) {
        this.nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        this.webView = webView;
    }

    @JavascriptInterface
    public void startDiscovery() {
        stopDiscovery();
        discoveredServices.clear();
        
        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Discovery failed: Error code:" + errorCode);
                nsdManager.stopServiceDiscovery(this);
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Stop discovery failed: Error code:" + errorCode);
                nsdManager.stopServiceDiscovery(this);
            }

            @Override
            public void onDiscoveryStarted(String serviceType) {
                Log.d(TAG, "Service discovery started");
                sendToWeb("onDiscoveryStarted", null);
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
                Log.i(TAG, "Discovery stopped: " + serviceType);
                sendToWeb("onDiscoveryStopped", null);
            }

            @Override
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service found: " + serviceInfo);
                if (serviceInfo.getServiceType().equals(SERVICE_TYPE)) {
                    nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                        @Override
                        public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                            Log.e(TAG, "Resolve failed: " + errorCode);
                        }

                        @Override
                        public void onServiceResolved(NsdServiceInfo serviceInfo) {
                            Log.d(TAG, "Resolve Succeeded. " + serviceInfo);
                            discoveredServices.add(serviceInfo);
                            notifyUpdate();
                        }
                    });
                }
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {
                Log.e(TAG, "service lost: " + serviceInfo);
                discoveredServices.removeIf(s -> s.getServiceName().equals(serviceInfo.getServiceName()));
                notifyUpdate();
            }
        };

        nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
    }

    @JavascriptInterface
    public void stopDiscovery() {
        if (discoveryListener != null) {
            try {
                nsdManager.stopServiceDiscovery(discoveryListener);
            } catch (Exception e) {
                Log.e(TAG, "Stop discovery error", e);
            }
            discoveryListener = null;
        }
    }

    private void notifyUpdate() {
        try {
            JSONArray array = new JSONArray();
            synchronized (discoveredServices) {
                for (NsdServiceInfo info : discoveredServices) {
                    JSONObject obj = new JSONObject();
                    obj.put("name", info.getServiceName());
                    obj.put("ip", info.getHost().getHostAddress());
                    obj.put("port", info.getPort());
                    array.put(obj);
                }
            }
            sendToWeb("onDevicesFound", array.toString());
        } catch (Exception e) {
            Log.e(TAG, "Error notifying update", e);
        }
    }

    private void sendToWeb(final String event, final String data) {
        webView.post(() -> {
            String script = String.format("window.dispatchEvent(new CustomEvent('nsd:%s', {detail: %s}));", 
                    event, data == null ? "null" : data);
            webView.evaluateJavascript(script, null);
        });
    }
}
