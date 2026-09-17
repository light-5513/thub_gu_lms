import re

with open('frontend/src/layouts/PortalLayouts.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix duplicate classNames
content = re.sub(r'className="([^"]*)"\s*className="([^"]*)"', r'className="\1 \2"', content)

content = re.sub(
    r'className="absolute top-4 right-4 rounded-md p-1.5 lg:hidden text-black"\s*className="ml-auto rounded-md p-1.5 lg:hidden"',
    r'className="absolute top-4 right-4 rounded-md p-1.5 lg:hidden text-black"',
    content
)

with open('frontend/src/layouts/PortalLayouts.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed duplicate classNames')
