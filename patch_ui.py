import os
import re

with open('frontend/src/features/admin/InvitationsPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace state
content = content.replace(
    'const [sentTo, setSentTo] = useState<string | null>(null);',
    'const [sentData, setSentData] = useState<{email: string, setupUrl?: string} | null>(null);'
)

# Replace mutate success
content = content.replace(
    'setSentTo(clean);',
    'setSentData({ email: clean, setupUrl: (res as any).setup_url });'
)

# Replace JSX rendering
old_jsx = """      {sentTo && (
        <div className="flex items-center gap-2 text-sm text-[#15803d] bg-[#15803d]/10 px-4 py-3 rounded-md mb-4 border border-[#15803d]/20">
          <CheckCircle2 size={16} />
          <span>
            Invitation sent to <strong>{sentTo}</strong>
          </span>
        </div>
      )}"""

new_jsx = """      {sentData && (
        <div className="flex flex-col gap-2 text-sm text-[#15803d] bg-[#15803d]/10 px-4 py-3 rounded-md mb-4 border border-[#15803d]/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>
              Invitation generated for <strong>{sentData.email}</strong>
            </span>
          </div>
          {sentData.setupUrl && (
            <div className="mt-1 flex items-center justify-between bg-white/60 p-2 rounded border border-[#15803d]/20">
               <span className="font-mono text-xs select-all text-slate-700">{sentData.setupUrl}</span>
            </div>
          )}
          {!sentData.setupUrl && <span className="text-xs opacity-80">(Email failed to send. Please check your email configuration.)</span>}
        </div>
      )}"""

content = content.replace(old_jsx, new_jsx)

with open('frontend/src/features/admin/InvitationsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated UI")
