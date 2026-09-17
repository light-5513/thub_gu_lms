import re

with open('frontend/src/layouts/PortalLayouts.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the button
bad_button = r'''          <button
            className="absolute top-4 right-4 rounded-md p-1.5 lg:hidden text-black ml-auto rounded-md p-1.5 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="text-black"
          >'''

good_button = r'''          <button
            className="absolute top-4 right-4 rounded-md p-1.5 lg:hidden text-black"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >'''

content = content.replace(bad_button, good_button)

# Also check for other duplicate classNames
# We can find all tags with multiple classNames
def fix_duplicate_classNames(match):
    # A single HTML tag
    tag_content = match.group(0)
    # Find all classNames
    classNames = re.findall(r'className="([^"]*)"', tag_content)
    if len(classNames) > 1:
        # Merge them
        merged = " ".join(classNames)
        # Remove all classNames from the tag
        tag_content_clean = re.sub(r'\s*className="[^"]*"', '', tag_content)
        # Re-add the merged className
        # Note: we need to insert it after the tag name
        tag_name = re.match(r'<([a-zA-Z0-9]+)', tag_content_clean).group(1)
        tag_content_fixed = tag_content_clean.replace(f'<{tag_name}', f'<{tag_name} className="{merged}"', 1)
        return tag_content_fixed
    return tag_content

content = re.sub(r'<[a-zA-Z0-9]+[^>]*>', fix_duplicate_classNames, content)

with open('frontend/src/layouts/PortalLayouts.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
