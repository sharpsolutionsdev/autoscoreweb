package com.dartvoice;

import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.util.Log;

public class DartvoiceWebChromeClient extends WebChromeClient {
    private static final String TAG = "DartvoiceWebClient";

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        Log.d(TAG, "onPermissionRequest called for: " + request.getResources()[0]);
        // Immediately grant all requested permissions (like RECORD_AUDIO)
        request.grant(request.getResources());
    }
}
