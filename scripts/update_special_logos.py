import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace curtain-logo contents with img tag
content = re.sub(r'<div class="curtain-logo" id="curtain-logo">.*?</div>', '<div class="curtain-logo" id="curtain-logo">\n            <img src="logo-transparent.png" alt="DartVoice" style="width: 120px; height: auto; object-fit: contain;">\n        </div>', content, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('web-app.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace cinema logo
content = re.sub(r'<div id="dv-cinema-logo" aria-hidden="true">.*?</div>', '<div id="dv-cinema-logo" aria-hidden="true">\n                <img src="logo-transparent.png" alt="DartVoice" class="dv-logo-letter show" style="width: 160px; height: auto; object-fit: contain; filter: drop-shadow(0 0 20px rgba(var(--brand-rgb), 0.6));">\n            </div>', content, flags=re.DOTALL)

with open('web-app.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated index and web-app special logos.')
