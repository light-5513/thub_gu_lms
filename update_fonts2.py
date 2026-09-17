import re

files = [
    'frontend/src/components/ui/hardware.tsx',
    'frontend/src/features/public/ContactPage.tsx',
    'frontend/src/layouts/AuthLayout.tsx'
]

for fpath in files:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace inline styles fontFamily
    content = re.sub(r'fontFamily:\s*"Poppins, sans-serif"', 'fontFamily: "Outfit, sans-serif"', content)
    
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated inline fonts to Outfit")
