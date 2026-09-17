import os

path = r"d:\Projects\PBC\frontend\src\features\student\ProfilePage.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace InfoRow component
old_inforow = '''function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-leather-50/80">{label}</dt>
      <dd className="min-w-0 text-leather-200">{value}</dd>
    </div>
  );
}'''

new_inforow = '''function InfoRow({ label, value, isEditing, readOnlyText }: { label: string; value: React.ReactNode; isEditing?: boolean; readOnlyText?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 mb-2">
      <dt className="text-[11px] font-extrabold uppercase tracking-widest text-leather-300">{label}</dt>
      <dd className="min-w-0 w-full">
        {isEditing ? (
          value
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 card-inset border-0 rounded-3xl text-[13px] font-bold text-leather-300">
            {readOnlyText || value || "—"}
          </div>
        )}
      </dd>
    </div>
  );
}'''
content = content.replace(old_inforow, new_inforow)

# Replace the dl block inside Personal information
old_dl = '''            <dl className="space-y-3 text-sm">
              <InfoRow label="First name" value={editing ? <Input value={form.first_name ?? p.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /> : p.first_name} />
              <InfoRow label="Last name" value={editing ? <Input value={form.last_name ?? p.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /> : p.last_name} />
              <InfoRow
                label="Email"
                value={
                  <span className="inline-flex items-center gap-2">
                    {p.email} <Badge tone="gray">read-only</Badge>
                  </span>
                }
              />
              <InfoRow label="Roll number" value={editing ? <Input value={form.roll_number ?? p.roll_number} onChange={(e) => setForm((f) => ({ ...f, roll_number: e.target.value }))} /> : p.roll_number} />
              <InfoRow
                label="Course"
                value={
                  editing ? (
                    <Select value={form.course ?? p.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}>
                      <option>B.Tech</option><option>M.Tech</option><option>BCA</option><option>MCA</option>
                    </Select>
                  ) : (
                    p.course
                  )
                }
              />
              <InfoRow
                label="Branch"
                value={
                  editing ? (
                    <Select value={form.branch ?? p.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}>
                      <option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option>
                    </Select>
                  ) : (
                    p.branch
                  )
                }
              />
              <InfoRow label="Section" value={editing ? <Input value={form.section ?? p.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} /> : p.section} />
              <InfoRow label="Phone" value={editing ? <Input value={form.phone ?? p.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /> : p.phone ?? "—"} />
            </dl>'''

new_dl = '''            <dl className="space-y-2">
              <InfoRow 
                label="First name" 
                isEditing={editing} 
                value={<Input value={form.first_name ?? p.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />} 
                readOnlyText={p.first_name} 
              />
              <InfoRow 
                label="Last name" 
                isEditing={editing} 
                value={<Input value={form.last_name ?? p.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />} 
                readOnlyText={p.last_name} 
              />
              <InfoRow
                label="Email"
                isEditing={false}
                value={null}
                readOnlyText={
                  <>
                    {p.email} <Badge tone="gray">read-only</Badge>
                  </>
                }
              />
              <InfoRow 
                label="Roll number" 
                isEditing={editing} 
                value={<Input value={form.roll_number ?? p.roll_number} onChange={(e) => setForm((f) => ({ ...f, roll_number: e.target.value }))} />} 
                readOnlyText={p.roll_number} 
              />
              <InfoRow
                label="Course"
                isEditing={editing}
                value={
                  <Select value={form.course ?? p.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}>
                    <option>B.Tech</option><option>M.Tech</option><option>BCA</option><option>MCA</option>
                  </Select>
                }
                readOnlyText={p.course}
              />
              <InfoRow
                label="Branch"
                isEditing={editing}
                value={
                  <Select value={form.branch ?? p.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}>
                    <option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option>
                  </Select>
                }
                readOnlyText={p.branch}
              />
              <InfoRow 
                label="Section" 
                isEditing={editing} 
                value={<Input value={form.section ?? p.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />} 
                readOnlyText={p.section} 
              />
              <InfoRow 
                label="Phone" 
                isEditing={editing} 
                value={<Input value={form.phone ?? p.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />} 
                readOnlyText={p.phone} 
              />
            </dl>'''
content = content.replace(old_dl, new_dl)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
