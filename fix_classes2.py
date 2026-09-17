import re

with open('frontend/src/layouts/PortalLayouts.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('className="mt-1 text-[12px] font-bold" className="text-black"', 'className="mt-1 text-[12px] font-bold text-black"')
content = content.replace('className="text-xs font-bold" className="text-black"', 'className="text-xs font-bold text-black"')
content = content.replace('className="text-sm font-extrabold leading-none" className="text-black"', 'className="text-sm font-extrabold leading-none text-black"')

with open('frontend/src/layouts/PortalLayouts.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
