import glob
import re

for filepath in glob.glob('app/templates/email/*.html'):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace the header background and h1
    new_header = (
        '<td style="background:#ffffff; border-bottom:1px solid #e2e8f0; padding:24px 32px; text-align:center;">\n'
        '              <img src="{{ app_url }}/logo.png" alt="{{ application_name }}" style="max-height:40px; width:auto; display:block; margin:0 auto;" />\n'
        '            </td>'
    )
    
    content = re.sub(
        r'<td style="background:#1e3a5f; padding:24px 32px; text-align:center;">\s*<h1 style="color:#ffffff; margin:0; font-size:22px;">\{\{\s*application_name\s*\}\}</h1>\s*</td>',
        new_header,
        content
    )
    
    # Replace blue buttons with dark green buttons
    content = content.replace('background:#2563eb;', 'background:#15803d;')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated {filepath}")
