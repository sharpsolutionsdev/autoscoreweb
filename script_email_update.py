import os
import re

EMAILS_DIR = r"c:\Users\vrynw\Documents\GitHub\dartvoice\testomg\emails"

FONT_LINK = """    <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>"""

for file in os.listdir(EMAILS_DIR):
    if not file.endswith('.html'): continue
    path = os.path.join(EMAILS_DIR, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add Rubik link to header
    if 'family=Rubik' not in content:
        content = content.replace('</head>', FONT_LINK)
    
    # Replace Arial -> Rubik
    content = content.replace('font-family:Arial,Helvetica,sans-serif;', "font-family:'Rubik',Arial,sans-serif;")
    content = content.replace('font-family:Arial,sans-serif;', "font-family:'Rubik',Arial,sans-serif;")

    # Soften main wrapper border-radius
    content = content.replace('border-radius:16px;', 'border-radius:24px;')

    # Replace button radius
    content = content.replace('border-radius:10px;', 'border-radius:14px;')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file}")
