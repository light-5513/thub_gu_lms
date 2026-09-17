import os
import re

files_to_fix = [
    'frontend/src/features/admin/StudentReportPage.tsx',
    'frontend/src/features/public/ContactPage.tsx',
    'frontend/src/layouts/AuthLayout.tsx',
]

for path in files_to_fix:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(r'background:\s*"linear-gradient\([^)]+\)",?', '', content)
    content = re.sub(r'backgroundImage:\s*"linear-gradient\([^)]+\)",?', '', content)
    content = re.sub(r'backgroundImage:\s*\n\s*"linear-gradient\([^)]+\)",?', '', content)
    content = re.sub(r'border:\s*"1px solid rgba\(0,\s*0,\s*0,\s*0\.[0-9]+\)",?', '', content)
    content = re.sub(r'color:\s*"#ffffff",?', '', content)
    
    # Remove boxShadow with inset matching
    content = re.sub(r'boxShadow:\s*\n?\s*"inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.30\).*?",?', '', content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Cleaned {path}')
