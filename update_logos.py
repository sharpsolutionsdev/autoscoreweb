import glob

files = glob.glob('*.html')

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content.replace('<link rel="icon" type="image/svg+xml" href="favicon.svg">', '<link rel="icon" type="image/png" href="favicon.png">')
    new_content = new_content.replace('<link rel="icon" href="/favicon.ico">', '<link rel="icon" type="image/png" href="favicon.png">')
    
    # Text logo DARTVOICE
    logo_str = '<div class="logo">DART<span class="red">VOICE</span></div>'
    new_logo_str = '<img src="logo-transparent.png" alt="DartVoice Logo" class="logo" style="height: 48px; width: auto; object-fit: contain;">'
    new_content = new_content.replace(logo_str, new_logo_str)
    
    if new_content != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)

print('Updated exact replacements.')
