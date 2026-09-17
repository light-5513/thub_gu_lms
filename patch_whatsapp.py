import os

with open('frontend/src/features/admin/InvitationsPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_jsx = """              {sentData.setupUrl && (
                <div className="mt-1 flex items-center justify-between bg-white p-2 rounded border border-emerald-200">
                   <span className="font-mono text-xs select-all">{sentData.setupUrl}</span>
                </div>
              )}"""

new_jsx = """              {sentData.setupUrl && (
                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-white p-2 rounded border border-emerald-200">
                     <span className="font-mono text-xs select-all">{sentData.setupUrl}</span>
                  </div>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent("Here is your invitation link to join the LMS platform: " + sentData.setupUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#20bd5a]"
                  >
                    Send via WhatsApp
                  </a>
                </div>
              )}"""

content = content.replace(old_jsx, new_jsx)

with open('frontend/src/features/admin/InvitationsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Added WhatsApp button")
