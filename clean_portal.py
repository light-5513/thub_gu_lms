import re

with open('frontend/src/layouts/PortalLayouts.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove background: "linear-gradient(..." lines
content = re.sub(r'\s*background:\s*"linear-gradient[^"]+",\n', '\n', content)

# 2. Replace GraduationCap in logo boxes with img tag (Admin)
content = re.sub(
    r'<div[^>]*>\s*<GraduationCap\s+size=\{19\}\s*/>\s*</div>',
    '<img src="/logo.png" alt="Technical Hub" className="h-10 w-auto object-contain drop-shadow-sm" />',
    content
)

# Replace GraduationCap in logo boxes with img tag (Student)
content = re.sub(
    r'<div[^>]*>\s*<GraduationCap\s+size=\{18\}\s*/>\s*</div>',
    '<img src="/logo.png" alt="Technical Hub" className="h-10 w-auto object-contain drop-shadow-sm" />',
    content
)

# 3. Remove all .brand-strip elements (top and bottom) safely
# A simple way is to remove <div className="brand-strip ...>...</div> if it doesn't have nested divs other than <div className="screw" /> or <div className="led ... /> 
content = re.sub(r'\s*\{\/\*\s*(?:Bottom )?brand strip(?: header)?\s*\*\/\}\n\s*<div className="brand-strip[^>]*>[\s\S]*?(?:<div className="screw" />\s*</div>|</div>\s*</div>)', '', content)

# 4. Remove mobile menu brand strip class
content = content.replace('className="brand-strip px-4 py-2 sm:hidden"', 'className="px-4 py-2 sm:hidden"')

# 5. Remove all tech-label paragraphs and spans
content = re.sub(r'\s*<p className="tech-label[^>]*>.*?</p>', '', content)
content = re.sub(r'\s*<span className="tech-label[^>]*>.*?</span>', '', content)

# 6. Remove the Breadcrumb / page indicator completely
content = re.sub(r'\s*\{\/\* Breadcrumb / page indicator \*\/\}\n\s*<div className="brand-strip[^>]*>[\s\S]*?(?:ACTIVE</span>\s*</div>\s*</div>)', '', content)

# 7. Remove any leftover LEDs that were outside of brand strips (if any)
content = re.sub(r'\s*<div className="led[^>]*>.*?</div>', '', content)

# 8. Remove unused imports
content = re.sub(r'GraduationCap,\s*', '', content)

with open('frontend/src/layouts/PortalLayouts.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Restored and cleaned PortalLayouts.tsx safely")
