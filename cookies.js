/* cookies.js â€” Cookie consent banner (v1, cosmetic only) */
(function () {
    if (localStorage.getItem('dv-cookie-consent')) return;

    var bar = document.createElement('div');
    bar.id = 'dv-cookie-bar';
    bar.setAttribute('style',
        'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
        'background:#111114;border-top:1px solid rgba(255,255,255,0.08);' +
        'padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;' +
        'justify-content:center;gap:12px;font-family:"Plus Jakarta Sans",system-ui,sans-serif;' +
        'animation:dvCookieIn .35s ease'
    );

    bar.innerHTML =
        '<p style="margin:0;color:#9E9EB0;font-size:13px;max-width:480px;line-height:1.5;text-align:center;">' +
            'We use cookies to improve your experience. ' +
            '<a href="html/terms.html" style="color:#CC0B20;text-decoration:underline;">Learn more</a>' +
        '</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">' +
            '<button data-cc="all" style="' + btnStyle('#CC0B20', '#fff') + '">Accept All</button>' +
            '<button data-cc="essentials" style="' + btnStyle('transparent', '#F0F0F5') + 'border:1px solid rgba(255,255,255,0.12);">Essentials Only</button>' +
            '<button data-cc="decline" style="' + btnStyle('transparent', '#6E6E82') + '">Decline</button>' +
        '</div>';

    // Animation keyframe
    var style = document.createElement('style');
    style.textContent = '@keyframes dvCookieIn{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}' +
        '@keyframes dvCookieOut{from{transform:translateY(0);opacity:1}to{transform:translateY(100%);opacity:0}}';
    document.head.appendChild(style);

    bar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-cc]');
        if (!btn) return;
        localStorage.setItem('dv-cookie-consent', btn.dataset.cc);
        // Show toast
        showToast();
        // Slide out
        bar.style.animation = 'dvCookieOut .3s ease forwards';
        setTimeout(function () { bar.remove(); }, 350);
    });

    document.body.appendChild(bar);

    function btnStyle(bg, color) {
        return 'background:' + bg + ';color:' + color + ';' +
            'border:none;border-radius:10px;padding:9px 18px;font-size:13px;' +
            'font-weight:600;cursor:pointer;white-space:nowrap;transition:opacity .15s;';
    }

    function showToast() {
        var toast = document.createElement('div');
        toast.setAttribute('style',
            'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100000;' +
            'background:#1a1a1f;border:1px solid rgba(255,255,255,0.1);border-radius:12px;' +
            'padding:12px 24px;font-family:"Plus Jakarta Sans",system-ui,sans-serif;' +
            'font-size:13px;font-weight:600;color:#22c55e;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:dvCookieIn .3s ease'
        );
        toast.textContent = 'âœ“ Preferences saved';
        document.body.appendChild(toast);
        setTimeout(function () {
            toast.style.animation = 'dvCookieOut .3s ease forwards';
            setTimeout(function () { toast.remove(); }, 350);
        }, 2000);
    }
})();

