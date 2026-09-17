import base64
import glob

with open('frontend/public/logo.png', 'rb') as f:
    b64_img = base64.b64encode(f.read()).decode('utf-8')

for filepath in glob.glob('app/templates/email/*.html'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the img src
    new_src = f'data:image/png;base64,{b64_img}'
    content = content.replace('src="{{ app_url }}/logo.png"', f'src="{new_src}"')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print("Updated email templates with Base64 inline image.")
