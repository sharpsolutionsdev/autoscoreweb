/* ── DartVoice Theme Picker v2 ──
 *  Rewrites ALL brand-red: <style> blocks, inline styles, SVG attributes.
 *  Add to <head> for FOUC prevention:
 *    <script>!function(){var h=localStorage.getItem('dv-theme-hex');if(h){document.documentElement.style.setProperty('--brand',h)}}()</script>
 */
(function () {
    'use strict';

    var PRESETS = [
        { id: 'red',     hex: '#CC0B20', r: 204, g: 11,  b: 32,  label: 'Red' },
        { id: 'orange',  hex: '#F97316', r: 249, g: 115, b: 22,  label: 'Orange' },
        { id: 'gold',    hex: '#EAB308', r: 234, g: 179, b: 8,   label: 'Gold' },
        { id: 'emerald', hex: '#10B981', r: 16,  g: 185, b: 129, label: 'Emerald' },
        { id: 'cyan',    hex: '#06B6D4', r: 6,   g: 182, b: 212, label: 'Cyan' },
        { id: 'blue',    hex: '#2563EB', r: 37,  g: 99,  b: 235, label: 'Blue' },
        { id: 'purple',  hex: '#7C3AED', r: 124, g: 58,  b: 237, label: 'Purple' },
        { id: 'pink',    hex: '#EC4899', r: 236, g: 72,  b: 153, label: 'Pink' },
    ];

    var SRC_HEX = '#CC0B20';
    var SRC_LIGHT = '#e60d24';
    var SRC_DARK = '#1A0608';
    var activeId = localStorage.getItem('dv-theme') || 'red';
    if (!PRESETS.find(function (p) { return p.id === activeId; })) activeId = 'red';

    function preset(id) { return PRESETS.find(function (p) { return p.id === id; }) || PRESETS[0]; }

    function lighten(hex, pct) {
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, r + Math.round((255 - r) * pct / 100));
        g = Math.min(255, g + Math.round((255 - g) * pct / 100));
        b = Math.min(255, b + Math.round((255 - b) * pct / 100));
        return '#' + [r, g, b].map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
    }

    function darken(hex, pct) {
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        r = Math.max(0, Math.round(r * (1 - pct / 100)));
        g = Math.max(0, Math.round(g * (1 - pct / 100)));
        b = Math.max(0, Math.round(b * (1 - pct / 100)));
        return '#' + [r, g, b].map(function (c) { return c.toString(16).padStart(2, '0'); }).join('');
    }

    function recolorStr(src, t) {
        var light = lighten(t.hex, 12);
        var dark = darken(t.hex, 90);
        return src
            .replace(/#CC0B20/gi, t.hex)
            .replace(/#e60d24/gi, light)
            .replace(/#1A0608/gi, dark)
            .replace(/rgba\(\s*204\s*,\s*11\s*,\s*32/gi, 'rgba(' + t.r + ',' + t.g + ',' + t.b)
            .replace(/rgba\(\s*204,\s*11,\s*32/gi, 'rgba(' + t.r + ',' + t.g + ',' + t.b)
            .replace(/rgba\s*\(\s*var\(\s*--brand-rgb\s*\)\s*,/gi, 'rgba(' + t.r + ', ' + t.g + ', ' + t.b + ',');
    }

    /* ── Snapshots: SVG elements that can't use CSS variables ── */
    var snapshots = null;

    function match(s) {
        return /#CC0B20|#e60d24|#1A0608|rgba\(\s*204[\s,]+11[\s,]+32|rgba\(\s*var\(\s*--brand-rgb/i.test(s);
    }

    function takeSnapshots() {
        snapshots = { svgs: [] };

        /* Only snapshot SVG attributes (they don't respond to CSS variables) */
        var svgParents = document.querySelectorAll('svg');
        for (var k = 0; k < svgParents.length; k++) {
            if (svgParents[k].closest && (svgParents[k].closest('#dv-theme-picker') || svgParents[k].closest('[data-no-theme]'))) continue;
            
            // Check parent SVG element itself
            var svgF = (svgParents[k].getAttribute('fill') || '').toUpperCase();
            var svgS = (svgParents[k].getAttribute('stroke') || '').toUpperCase();
            if (svgF === '#CC0B20' || svgS === '#CC0B20' || svgF.indexOf('204') > -1 || svgS.indexOf('204') > -1) {
                snapshots.svgs.push({ el: svgParents[k], origFill: svgParents[k].getAttribute('fill'), origStroke: svgParents[k].getAttribute('stroke') });
            }
            
            // Check all child elements
            var allChildren = svgParents[k].querySelectorAll('*');
            for (var m = 0; m < allChildren.length; m++) {
                var se = allChildren[m];
                var f = (se.getAttribute('fill') || '').toUpperCase();
                var s = (se.getAttribute('stroke') || '').toUpperCase();
                if (f === '#CC0B20' || s === '#CC0B20' || f.indexOf('204') > -1 || s.indexOf('204') > -1) {
                    snapshots.svgs.push({ el: se, origFill: se.getAttribute('fill'), origStroke: se.getAttribute('stroke') });
                }
            }
        }
    }

    function applySnapshots(t) {
        if (!snapshots) return;
        var i;

        /* SVG attributes */
        for (i = 0; i < snapshots.svgs.length; i++) {
            var sv = snapshots.svgs[i];
            if (sv.origFill) {
                var newFill = recolorStr(sv.origFill, t);
                if (newFill !== sv.origFill) sv.el.setAttribute('fill', newFill);
            }
            if (sv.origStroke) {
                var newStroke = recolorStr(sv.origStroke, t);
                if (newStroke !== sv.origStroke) sv.el.setAttribute('stroke', newStroke);
            }
        }
    }

    /* ── Apply Theme ── */
    function apply(id) {
        var t = preset(id);
        activeId = id;
        localStorage.setItem('dv-theme', id);
        localStorage.setItem('dv-theme-hex', t.hex);

        var ds = document.documentElement.style;
        ds.setProperty('--brand', t.hex);
        ds.setProperty('--brand-r', String(t.r));
        ds.setProperty('--brand-g', String(t.g));
        ds.setProperty('--brand-b', String(t.b));
        ds.setProperty('--brand-rgb', String(t.r) + ', ' + String(t.g) + ', ' + String(t.b));
        ds.setProperty('--brand-light', lighten(t.hex, 12));

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', t.hex);

        // Apply SVG snapshots only (CSS variables handle inline styles automatically)
        applySnapshots(t);
        updatePicker(id);
    }

    /* ── Picker UI ── */
    var isOpen = false;

    function render() {
        var t = preset(activeId);

        var css = document.createElement('style');
        css.id = 'dv-tp-css';
        css.textContent =
            '#dv-theme-picker{position:fixed;bottom:20px;right:20px;z-index:99999;font-family:"Plus Jakarta Sans","Helvetica Neue",Arial,sans-serif}' +
            '#dv-tp-panel{position:absolute;bottom:52px;right:0;background:#111114;border:1px solid #252530;border-radius:16px;padding:16px;min-width:196px;' +
            'box-shadow:0 16px 48px rgba(0,0,0,.65);opacity:0;transform:translateY(8px) scale(.95);pointer-events:none;transition:opacity .2s ease,transform .2s ease}' +
            '#dv-tp-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}' +
            '#dv-tp-label{font-size:10px;font-weight:700;color:#6E6E82;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px}' +
            '#dv-tp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}' +
            '.dv-sw{width:36px;height:36px;border-radius:10px;border:2.5px solid transparent;cursor:pointer;transition:border .15s,box-shadow .15s,transform .12s;outline:none;padding:0}' +
            '.dv-sw:hover{border-color:#4A4A5A;transform:scale(1.08)}' +
            '.dv-sw.on{border-color:#F0F0F5}' +
            '#dv-tp-btn{width:42px;height:42px;border-radius:12px;border:2px solid #252530;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
            'outline:none;transition:background .2s,box-shadow .25s,transform .15s}' +
            '#dv-tp-btn:hover{transform:scale(1.1)}' +
            '#dv-tp-btn:active{transform:scale(.93)}' +
            '@media(max-width:640px){#dv-theme-picker{bottom:16px;right:16px}' +
            '#dv-tp-panel{min-width:176px;padding:14px}.dv-sw{width:32px;height:32px}#dv-tp-btn{width:38px;height:38px}}';
        document.head.appendChild(css);

        var root = document.createElement('div');
        root.id = 'dv-theme-picker';

        var panel = document.createElement('div');
        panel.id = 'dv-tp-panel';

        var label = document.createElement('div');
        label.id = 'dv-tp-label';
        label.textContent = 'Theme';
        panel.appendChild(label);

        var grid = document.createElement('div');
        grid.id = 'dv-tp-grid';

        PRESETS.forEach(function (p) {
            var sw = document.createElement('button');
            sw.className = 'dv-sw' + (p.id === activeId ? ' on' : '');
            sw.dataset.id = p.id;
            sw.title = p.label;
            sw.style.background = p.hex;
            if (p.id === activeId) sw.style.boxShadow = '0 0 14px ' + p.hex + '55';
            sw.addEventListener('click', function (e) {
                e.stopPropagation();
                apply(p.id);
            });
            grid.appendChild(sw);
        });

        panel.appendChild(grid);

        var btn = document.createElement('button');
        btn.id = 'dv-tp-btn';
        btn.setAttribute('aria-label', 'Theme color');
        btn.style.background = t.hex;
        btn.style.boxShadow = '0 4px 20px ' + t.hex + '45';
        btn.innerHTML =
            '<svg width="18" height="18" viewBox="0 0 18 18" fill="none">' +
            '<rect x="1" y="1" width="7" height="7" rx="2" fill="white" fill-opacity=".9"/>' +
            '<rect x="10" y="1" width="7" height="7" rx="2" fill="white" fill-opacity=".5"/>' +
            '<rect x="1" y="10" width="7" height="7" rx="2" fill="white" fill-opacity=".5"/>' +
            '<rect x="10" y="10" width="7" height="7" rx="2" fill="white" fill-opacity=".22"/>' +
            '</svg>';
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            isOpen = !isOpen;
            panel.classList.toggle('open', isOpen);
        });

        root.appendChild(panel);
        root.appendChild(btn);
        document.body.appendChild(root);

        document.addEventListener('click', function () {
            if (isOpen) { isOpen = false; panel.classList.remove('open'); }
        });
        root.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    function updatePicker(id) {
        var t = preset(id);
        var btn = document.getElementById('dv-tp-btn');
        if (btn) {
            btn.style.background = t.hex;
            btn.style.boxShadow = '0 4px 20px ' + t.hex + '45';
        }
        var sws = document.querySelectorAll('.dv-sw');
        for (var i = 0; i < sws.length; i++) {
            var sw = sws[i];
            var on = sw.dataset.id === id;
            sw.className = 'dv-sw' + (on ? ' on' : '');
            sw.style.boxShadow = on ? '0 0 14px ' + preset(sw.dataset.id).hex + '55' : 'none';
        }
    }

    /* ── Boot ── */
    function init() {
        takeSnapshots();
        render();
        if (activeId !== 'red') apply(activeId);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
