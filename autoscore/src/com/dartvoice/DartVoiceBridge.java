package com.dartvoice;

import android.app.Activity;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.Log;
import android.util.TypedValue;

/**
 * JavaScript bridge between the DartVoice mobile control panel
 * (web-app-mobile.html) and the DartCounter scorer WebView.
 *
 * Exposed to JS as window.DartVoiceBridge via addJavascriptInterface().
 */
public class DartVoiceBridge {
    private static final String TAG = "DartVoiceBridge";

    private final Activity activity;
    private final FrameLayout rootFrame;

    private WebView scorerView;
    private Button backButton;
    private boolean scorerCreated = false;

    public DartVoiceBridge(Activity activity, FrameLayout rootFrame) {
        this.activity = activity;
        this.rootFrame = rootFrame;
    }

    // ── Scorer WebView (lazy init) ──────────────────────────────────────

    private void ensureScorerView() {
        if (scorerCreated) return;
        scorerCreated = true;

        scorerView = new WebView(activity);
        WebSettings settings = scorerView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Pretend to be real Chrome so DartCounter serves mobile UI
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        );

        // Persist login cookies
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        try { cm.setAcceptThirdPartyCookies(scorerView, true); } catch (Exception e) { /* API < 21 */ }

        scorerView.setWebViewClient(new WebViewClient());
        scorerView.setWebChromeClient(new DartvoiceWebChromeClient());
        scorerView.loadUrl("https://app.dartcounter.net/dashboard");
        scorerView.setVisibility(View.GONE);

        FrameLayout.LayoutParams wvLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        rootFrame.addView(scorerView, wvLp);

        // Enable remote debugging
        try { WebView.setWebContentsDebuggingEnabled(true); } catch (Exception e) { }

        // Create floating BACK button
        backButton = new Button(activity);
        backButton.setText("← BACK TO CONTROLS");
        backButton.setTextColor(Color.WHITE);
        backButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        backButton.setTypeface(null, Typeface.BOLD);
        backButton.setAllCaps(true);

        // Rounded dark background
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xE6111114); // ~90% opaque dark
        bg.setCornerRadius(40f);
        bg.setStroke(2, 0x33FFFFFF); // subtle border
        backButton.setBackground(bg);
        backButton.setPadding(60, 28, 60, 28);
        backButton.setElevation(12f);

        backButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                closeScorer();
            }
        });

        FrameLayout.LayoutParams btnLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        btnLp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        btnLp.bottomMargin = 60;
        rootFrame.addView(backButton, btnLp);
        backButton.setVisibility(View.GONE);

        Log.d(TAG, "Scorer WebView created (lazy)");
    }

    // ── JS Interface Methods ────────────────────────────────────────────

    /**
     * Execute arbitrary JavaScript on the DartCounter scorer WebView.
     * Called from web-app-mobile.html to inject scores.
     */
    @JavascriptInterface
    public void evaluateOnScorer(final String js) {
        if (scorerView == null) {
            Log.w(TAG, "evaluateOnScorer called but scorerView is null");
            return;
        }
        scorerView.post(new Runnable() {
            @Override
            public void run() {
                try {
                    scorerView.evaluateJavascript(js, null);
                    Log.d(TAG, "JS injected into scorer: " + js.substring(0, Math.min(js.length(), 80)));
                } catch (Exception e) {
                    Log.e(TAG, "evaluateJavascript failed", e);
                }
            }
        });
    }

    /**
     * Show the DartCounter scorer WebView (full-screen overlay).
     */
    @JavascriptInterface
    public void openScorer() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                ensureScorerView();
                scorerView.setVisibility(View.VISIBLE);
                scorerView.bringToFront();
                if (backButton != null) {
                    backButton.setVisibility(View.VISIBLE);
                    backButton.bringToFront();
                }
                Log.d(TAG, "Scorer opened");
            }
        });
    }

    /**
     * Hide the DartCounter scorer WebView, returning to the control panel.
     */
    @JavascriptInterface
    public void closeScorer() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (scorerView != null) {
                    scorerView.setVisibility(View.GONE);
                }
                if (backButton != null) {
                    backButton.setVisibility(View.GONE);
                }
                Log.d(TAG, "Scorer closed");
            }
        });
    }

    /**
     * Check if the scorer is currently visible.
     */
    @JavascriptInterface
    public boolean isScorerOpen() {
        return scorerView != null && scorerView.getVisibility() == View.VISIBLE;
    }
}
