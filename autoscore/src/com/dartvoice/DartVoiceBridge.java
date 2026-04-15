package com.dartvoice;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

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
    private final Handler uiHandler;

    private WebView scorerView;
    private LinearLayout statusPill;
    private View statusDot;
    private TextView statusLabel;
    private boolean scorerCreated = false;
    private String currentState = "idle";
    private Runnable checkoutPoller;

    public DartVoiceBridge(Activity activity, FrameLayout rootFrame) {
        this.activity = activity;
        this.rootFrame = rootFrame;
        this.uiHandler = new Handler(Looper.getMainLooper());
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
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        );

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        try { cm.setAcceptThirdPartyCookies(scorerView, true); } catch (Exception e) { }

        scorerView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectScorerHelpers(view);
            }
        });
        scorerView.setWebChromeClient(new DartvoiceWebChromeClient());
        scorerView.loadUrl("https://app.dartcounter.net/dashboard");
        scorerView.setVisibility(View.GONE);

        FrameLayout.LayoutParams wvLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        rootFrame.addView(scorerView, wvLp);

        try { WebView.setWebContentsDebuggingEnabled(true); } catch (Exception e) { }

        createStatusPill();

        Log.d(TAG, "Scorer WebView created (lazy)");
    }

    // ── Status Pill (replaces BACK button, shows live voice state) ──────

    private void createStatusPill() {
        statusPill = new LinearLayout(activity);
        statusPill.setOrientation(LinearLayout.HORIZONTAL);
        statusPill.setGravity(Gravity.CENTER_VERTICAL);
        int padH = dp(18);
        int padV = dp(10);
        statusPill.setPadding(padH, padV, padH, padV);

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xE6111114);
        bg.setCornerRadius(dp(28));
        bg.setStroke(dp(1), 0x33FFFFFF);
        statusPill.setBackground(bg);
        statusPill.setElevation(dp(10));

        // Pulsing dot
        statusDot = new View(activity);
        int dotSize = dp(10);
        LinearLayout.LayoutParams dotLp = new LinearLayout.LayoutParams(dotSize, dotSize);
        dotLp.rightMargin = dp(10);
        statusDot.setLayoutParams(dotLp);
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);
        dotBg.setColor(0xFFCC0B20);
        statusDot.setBackground(dotBg);
        statusPill.addView(statusDot);

        // Status text
        statusLabel = new TextView(activity);
        statusLabel.setText("LISTENING");
        statusLabel.setTextColor(Color.WHITE);
        statusLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        statusLabel.setTypeface(null, Typeface.BOLD);
        statusLabel.setAllCaps(true);
        statusLabel.setLetterSpacing(0.12f);
        statusPill.addView(statusLabel);

        // Tap to return to controls
        statusPill.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                closeScorer();
            }
        });

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        lp.topMargin = dp(24);
        rootFrame.addView(statusPill, lp);
        statusPill.setVisibility(View.GONE);
    }

    private int dp(int value) {
        float density = activity.getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    private void applyStatusStyle(String state) {
        if (statusDot == null || statusLabel == null) return;
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);

        switch (state) {
            case "listening":
                statusLabel.setText("LISTENING");
                statusLabel.setTextColor(0xFFCC0B20);
                dotBg.setColor(0xFFCC0B20);
                break;
            case "checkout":
                statusLabel.setText("CHECKOUT");
                statusLabel.setTextColor(0xFFFACC15);
                dotBg.setColor(0xFFFACC15);
                break;
            case "cooldown":
                statusLabel.setText("PROCESSING");
                statusLabel.setTextColor(0xFF94A3B8);
                dotBg.setColor(0xFF94A3B8);
                break;
            case "recovering":
                statusLabel.setText("RECONNECTING");
                statusLabel.setTextColor(0xFFEF4444);
                dotBg.setColor(0xFFEF4444);
                break;
            case "idle":
            default:
                statusLabel.setText("MIC OFF");
                statusLabel.setTextColor(0xFF6E6E82);
                dotBg.setColor(0xFF4A4A5A);
                break;
        }
        statusDot.setBackground(dotBg);
    }

    // ── Keyboard suppression + checkout detection injected into scorer ──

    private void injectScorerHelpers(WebView view) {
        // Suppress soft keyboard by overriding focus + adding inputmode=none
        String suppressKeyboard =
            "(function(){" +
            "  try {" +
            "    var style = document.createElement('style');" +
            "    style.textContent = 'input, textarea { caret-color: transparent !important; }';" +
            "    document.head.appendChild(style);" +
            "    function patch(el) {" +
            "      try { el.setAttribute('inputmode','none'); } catch(e){}" +
            "      el.addEventListener('focus', function(ev){ try { el.blur(); } catch(e){} }, true);" +
            "      el.addEventListener('touchstart', function(ev){ ev.preventDefault(); }, {passive:false});" +
            "    }" +
            "    function patchAll() {" +
            "      var inputs = document.querySelectorAll('input, textarea');" +
            "      for (var i=0;i<inputs.length;i++){ patch(inputs[i]); }" +
            "    }" +
            "    patchAll();" +
            "    var mo = new MutationObserver(function(){ patchAll(); });" +
            "    mo.observe(document.body, {subtree:true, childList:true});" +
            "  } catch(e) { console.log('suppress err', e); }" +
            "})();";
        view.evaluateJavascript(suppressKeyboard, null);

        startCheckoutPoller();
    }

    private void startCheckoutPoller() {
        if (checkoutPoller != null) uiHandler.removeCallbacks(checkoutPoller);
        checkoutPoller = new Runnable() {
            @Override
            public void run() {
                if (scorerView == null || scorerView.getVisibility() != View.VISIBLE) {
                    uiHandler.postDelayed(this, 1500);
                    return;
                }
                String js =
                    "(function(){" +
                    "  try {" +
                    "    var txt = (document.body.innerText || '').toLowerCase();" +
                    "    var re = /how many darts|darts thrown|checkout.*darts|darts used/;" +
                    "    return re.test(txt) ? '1' : '0';" +
                    "  } catch(e) { return '0'; }" +
                    "})();";
                scorerView.evaluateJavascript(js, new android.webkit.ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        // value comes back as JSON string like "\"1\"" or "\"0\""
                        if (value != null && value.contains("1")) {
                            notifyControlPanel("window.onCheckoutDetected && window.onCheckoutDetected();");
                        } else {
                            notifyControlPanel("window.onCheckoutResolved && window.onCheckoutResolved();");
                        }
                    }
                });
                uiHandler.postDelayed(this, 1500);
            }
        };
        uiHandler.postDelayed(checkoutPoller, 1500);
    }

    private void notifyControlPanel(String js) {
        if (rootFrame == null) return;
        for (int i = 0; i < rootFrame.getChildCount(); i++) {
            View child = rootFrame.getChildAt(i);
            if (child instanceof WebView && child != scorerView) {
                final WebView ctrl = (WebView) child;
                ctrl.post(new Runnable() {
                    @Override
                    public void run() {
                        try { ctrl.evaluateJavascript(js, null); } catch (Exception e) { }
                    }
                });
                return;
            }
        }
    }

    private void hideKeyboard() {
        try {
            InputMethodManager imm = (InputMethodManager) activity.getSystemService(Activity.INPUT_METHOD_SERVICE);
            if (imm != null && scorerView != null) {
                imm.hideSoftInputFromWindow(scorerView.getWindowToken(), 0);
            }
        } catch (Exception e) { }
    }

    // ── JS Interface Methods ────────────────────────────────────────────

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
                    hideKeyboard();
                } catch (Exception e) {
                    Log.e(TAG, "evaluateJavascript failed", e);
                }
            }
        });
    }

    @JavascriptInterface
    public void openScorer() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                ensureScorerView();
                scorerView.setVisibility(View.VISIBLE);
                scorerView.bringToFront();
                if (statusPill != null) {
                    statusPill.setVisibility(View.VISIBLE);
                    statusPill.bringToFront();
                }
                applyStatusStyle(currentState);
            }
        });
    }

    @JavascriptInterface
    public void closeScorer() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (scorerView != null) scorerView.setVisibility(View.GONE);
                if (statusPill != null) statusPill.setVisibility(View.GONE);
                hideKeyboard();
            }
        });
    }

    @JavascriptInterface
    public boolean isScorerOpen() {
        return scorerView != null && scorerView.getVisibility() == View.VISIBLE;
    }

    @JavascriptInterface
    public void updateStatus(final String state) {
        currentState = state == null ? "idle" : state;
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() { applyStatusStyle(currentState); }
        });
    }

    @JavascriptInterface
    public void suppressKeyboard() {
        if (scorerView == null) return;
        scorerView.post(new Runnable() {
            @Override
            public void run() {
                injectScorerHelpers(scorerView);
                hideKeyboard();
            }
        });
    }
}
