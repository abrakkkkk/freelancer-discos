import sys
import re

file_path = 'src/app/globals.css'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix td width and word breaking in mobile
content = re.sub(
    r'(td\s*\{[^}]*?justify-content:\s*space-between;)',
    r'\g<1>\n    gap: 8px;\n    word-break: break-word;',
    content
)

# Also make the font sizes a bit smaller for mobile
content = re.sub(r'(td\[data-label="Título"\]\s*\{[^}]*?font-size:\s*)15px;', r'\g<1>14px;', content)
content = re.sub(r'(td\[data-label="Artista"\]\s*\{[^}]*?font-size:\s*)13px;', r'\g<1>12px;', content)
content = re.sub(r'(td\s*\{[^}]*?font-size:\s*)13px;', r'\g<1>12px;', content)

# Change Título right padding which was 70px to something smaller like 50px
content = re.sub(r'(padding-right:\s*)70px;', r'\g<1>40px;', content)

# Add min-width to td to prevent flex from pushing boundaries
content = re.sub(
    r'(td\s*\{[^}]*?display:\s*flex;)',
    r'\g<1>\n    min-width: 0;',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
