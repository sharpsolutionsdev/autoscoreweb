import os
from kivy.app import App
from kivy.utils import platform

class DartVoiceWebApp(App):
    def build(self):
        if platform == 'android':
            from jnius import autoclass
            from android.runnable import run_on_ui_thread

            Activity = autoclass('org.kivy.android.PythonActivity').mActivity
            WebView = autoclass('android.webkit.WebView')
            WebChromeClient = autoclass('com.dartvoice.DartvoiceWebChromeClient')
            CustomWebViewClient = autoclass('com.dartvoice.DartvoiceWebViewClient')
            FrameLayout = autoclass('android.widget.FrameLayout')
            LayoutParams = autoclass('android.view.ViewGroup$LayoutParams')
            DartVoiceBridge = autoclass('com.dartvoice.DartVoiceBridge')

            @run_on_ui_thread
            def create_webview():
                # Root container for both WebViews
                frame = FrameLayout(Activity)

                # â”€â”€ Control Panel WebView (html/web-app-mobile.html) â”€â”€
                control_wv = WebView(Activity)
                settings = control_wv.getSettings()
                settings.setJavaScriptEnabled(True)
                settings.setDomStorageEnabled(True)
                settings.setMediaPlaybackRequiresUserGesture(False)
                settings.setAllowFileAccessFromFileURLs(True)
                settings.setAllowUniversalAccessFromFileURLs(True)

                control_wv.setWebChromeClient(WebChromeClient())
                control_wv.setWebViewClient(CustomWebViewClient())

                # Enable remote debugging
                try:
                    WebView.setWebContentsDebuggingEnabled(True)
                except Exception:
                    pass

                # â”€â”€ Create the JS Bridge â”€â”€
                # The bridge lazily creates the DartCounter WebView
                # and handles score injection between the two WebViews.
                bridge = DartVoiceBridge(Activity, frame)
                control_wv.addJavascriptInterface(bridge, 'DartVoiceBridge')

                # Load subscription gate first â€” gate redirects to app if active sub
                control_wv.loadUrl('https://dartvoice.app/html/apk-gate.html')

                # Add control panel to the root frame
                frame.addView(control_wv, LayoutParams(
                    LayoutParams.MATCH_PARENT,
                    LayoutParams.MATCH_PARENT
                ))

                # Set root frame as Activity content
                Activity.setContentView(frame)

            create_webview()

        from kivy.uix.widget import Widget
        return Widget()

if __name__ == '__main__':
    if platform == 'android':
        from android.permissions import request_permissions, Permission
        def perm_callback(permissions, results):
            pass
        request_permissions([Permission.RECORD_AUDIO], perm_callback)

    DartVoiceWebApp().run()

