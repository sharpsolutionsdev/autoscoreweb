package com.dartvoice;

import android.webkit.WebViewClient;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.content.Intent;
import android.net.Uri;

public class DartvoiceWebViewClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (url.contains("dartvoice.app")) {
            return false; // Load in WebView
        }
        
        // External link (e.g., Stripe, Dartcounter) -> launch in standard browser
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        view.getContext().startActivity(intent);
        return true; 
    }

    // Support for older Android versions
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url.contains("dartvoice.app")) {
            return false;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        view.getContext().startActivity(intent);
        return true;
    }
}
