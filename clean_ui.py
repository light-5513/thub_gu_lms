import os
import re

# AuthLayout.tsx
path = 'frontend/src/layouts/AuthLayout.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the top brand strip
content = re.sub(r'\s*\{\/\* Brand strip header \*\/\}\s*<div className="brand-strip[\s\S]*?</div>\s*</div>', '', content)

# Remove the 'ATTENDANCE CODING ANALYTICS' text
content = re.sub(r'\s*<p className="mt-1 tech-label"[^>]*>\s*ATTENDANCE.*?ANALYTICS\s*</p>', '', content)

# Remove the Footer strip 'SECURE ARGON2'
content = re.sub(r'\s*\{\/\* Footer strip \*\/\}\s*<div className="mt-4 flex items-center justify-between px-1">[\s\S]*?</div>\s*</div>', '', content)

# Remove the Bottom brand strip 'PORTAL STUDENT / STAFF 2025-26'
content = re.sub(r'\s*\{\/\* Bottom brand strip \*\/\}\s*<div className="brand-strip mt-3[\s\S]*?</div>\s*</div>', '', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# PortalLayouts.tsx
path2 = 'frontend/src/layouts/PortalLayouts.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    content2 = f.read()

# Remove brand strip headers
content2 = re.sub(r'\s*\{\/\* Brand strip header \*\/\}\s*<div className="brand-strip[\s\S]*?</div>\s*</div>', '', content2)

# Remove all <p className="tech-label">...</p>
content2 = re.sub(r'\s*<p className="tech-label[^>]*>.*?</p>', '', content2)
content2 = re.sub(r'\s*<span className="tech-label[^>]*>.*?</span>', '', content2)

# Remove the Breadcrumb / page indicator completely
content2 = re.sub(r'\s*\{\/\* Breadcrumb / page indicator[\s\S]*?</div>\s*</div>', '', content2)

# Also remove LEDs
content2 = re.sub(r'\s*<div className="led[^>]*>.*?</div>', '', content2)

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content2)

print('Cleaned AuthLayout.tsx and PortalLayouts.tsx')
