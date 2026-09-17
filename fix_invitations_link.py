import os

path = r"d:\Projects\PBC\frontend\src\features\admin\InvitationsPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove state
content = content.replace(
    'const [sentData, setSentData] = useState<{email: string, setupUrl?: string} | null>(null);',
    ''
)

# 2. Remove setting the state in submitSingle
content = content.replace(
    'setSentData({ email: clean, setupUrl: (res as any).setup_url });',
    ''
)

# 3. Remove the rendered block using a smart substring match
start_str = '{sentData && ('
end_str = ')}'
# It's a big chunk. Let's just do a manual replace using regex or string splitting, or string replace.
old_block = """          {sentData && (
            <div className="mt-3 flex flex-col gap-2 rounded-[20px] bg-primary-500 px-3 py-2 text-xs text-primary-500 ring-1 ring-primary-200 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary-500" /> 
                <span>Invitation generated for <strong>{sentData.email}</strong></span>
              </div>
              {sentData.setupUrl && (
                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-transparent p-2 rounded border border-emerald-200">
                    <span className="font-mono text-xs select-all">{sentData.setupUrl}</span>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent("Here is your invitation link to join the LMS platform: " + sentData.setupUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-2xl bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-card-pill hover:bg-[#20bd5a]"
                  >
                    Send via WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}"""

# Replace exact matches, falling back to substring removal if formatting varied
if old_block in content:
    content = content.replace(old_block, "")
else:
    # Try just matching the start and removing until the end of the div
    import re
    content = re.sub(r'\{sentData && \(\s*<div.*?\)\}', '', content, flags=re.DOTALL)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
