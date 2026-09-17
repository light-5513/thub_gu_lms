import os

with open('frontend/src/features/admin/InvitationsPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_jsx = """          {sentTo && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-black ring-1 ring-emerald-100 animate-fade-in">
              <CheckCircle2 size={14} /> Invitation sent to <strong>{sentTo}</strong>
            </div>
          )}"""

new_jsx = """          {sentData && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-200 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600" /> 
                <span>Invitation generated for <strong>{sentData.email}</strong></span>
              </div>
              {sentData.setupUrl && (
                <div className="mt-1 flex items-center justify-between bg-white p-2 rounded border border-emerald-200">
                   <span className="font-mono text-xs select-all">{sentData.setupUrl}</span>
                </div>
              )}
            </div>
          )}"""

content = content.replace(old_jsx, new_jsx)

with open('frontend/src/features/admin/InvitationsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed JSX")
