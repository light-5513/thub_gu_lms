import os
import re

replacements = {
    r'\btext-slate-900\b': 'text-leather-300',
    r'\btext-slate-800\b': 'text-leather-300',
    r'\btext-slate-700\b': 'text-leather-200',
    r'\btext-slate-600\b': 'text-leather-200',
    r'\btext-slate-500\b': 'text-leather-50/80',
    r'\btext-slate-400\b': 'text-leather-50/70',
    r'\btext-gray-900\b': 'text-leather-300',
    r'\btext-gray-800\b': 'text-leather-300',
    r'\btext-gray-700\b': 'text-leather-200',
    r'\btext-gray-600\b': 'text-leather-200',
    r'\btext-gray-500\b': 'text-leather-50/80',
    r'\btext-gray-400\b': 'text-leather-50/70',
    r'\bbg-slate-100\b': 'bg-cream-200',
    r'\bbg-slate-50\b': 'bg-cream-100',
    r'\bbg-slate-200\b': 'bg-cream-300',
    r'\bbg-gray-100\b': 'bg-cream-200',
    r'\bbg-gray-50\b': 'bg-cream-100',
    r'\bbg-white\b': 'bg-transparent',
    r'\bborder-slate-\d+\b': 'border-transparent',
    r'\bborder-gray-\d+\b': 'border-transparent',
    r'\bring-slate-\d+\b': 'ring-transparent',
    r'\bring-gray-\d+\b': 'ring-transparent',
    r'\bshadow-sm\b': 'shadow-pill',
    r'\bshadow-md\b': 'shadow-card',
    r'\bshadow-lg\b': 'shadow-card-lg',
    r'\bshadow\b': 'shadow-card',
}

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, rep in replacements.items():
        new_content = re.sub(pattern, rep, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Patched {filepath}")

for root, _, files in os.walk('d:/Projects/PBC/frontend/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            patch_file(os.path.join(root, file))
