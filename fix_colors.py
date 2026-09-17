import os
import re

files_to_fix = [
    'frontend/src/layouts/AuthLayout.tsx',
    'frontend/src/layouts/PortalLayouts.tsx',
    'frontend/src/features/public/ContactPage.tsx',
    'frontend/src/features/admin/StudentReportPage.tsx'
]

for path in files_to_fix:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace color: 'var(--text)' with color: '#ffffff' 
    # but only if it's right after a dark background gradient.
    content = re.sub(r'(background:\s*"linear-gradient\([^)]+\)",\s*color:\s*)"var\(--text\)"', r'\1"#ffffff"', content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {path}')
