import os
import re

count = 0
for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Remove empty style blocks
            new_content = re.sub(r'\s*style=\{\{\s*\}\}', '', content)
            
            # Remove unused import GraduationCap if it's not used in the file body
            if 'GraduationCap' in new_content:
                # Check if it's only in the import statement
                if len(re.findall(r'GraduationCap', new_content)) == 1:
                    new_content = re.sub(r',\s*GraduationCap', '', new_content)
                    new_content = re.sub(r'GraduationCap,\s*', '', new_content)
                    new_content = re.sub(r'import\s*\{\s*GraduationCap\s*\}\s*from\s*"lucide-react";\n?', '', new_content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Cleaned {path}')
                count += 1
print(f'Cleaned {count} files')
