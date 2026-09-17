import os

path = r"d:\Projects\PBC\frontend\src\features\auth\AcceptInvitationPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'interface InvitationInfo {\n  email: string;\n}',
    'interface InvitationInfo {\n  email: string;\n  role: string;\n}'
)

old_form = '''          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={errors.first_name}>
              <Input
                type="text"
                placeholder="John"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name" error={errors.last_name}>
              <Input
                type="text"
                placeholder="Doe"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </FormField>
          </div>
          
          <FormField label="Roll Number" error={errors.roll_number}>
            <Input
              type="text"
              placeholder="e.g. 21A91A0501"
              value={form.roll_number}
              onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Course" error={errors.course}>
              <Select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                <option value="B.Tech">B.Tech</option>
                <option value="M.Tech">M.Tech</option>
                <option value="MCA">MCA</option>
                <option value="MBA">MBA</option>
              </Select>
            </FormField>
            <FormField label="Branch" error={errors.branch}>
              <Input
                type="text"
                placeholder="CSE"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              />
            </FormField>
            <FormField label="Section" error={errors.section}>
              <Input
                type="text"
                placeholder="A"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
              />
            </FormField>
          </div>'''

new_form = '''          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={errors.first_name}>
              <Input
                type="text"
                placeholder="John"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </FormField>
            <FormField label="Last Name" error={errors.last_name}>
              <Input
                type="text"
                placeholder="Doe"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </FormField>
          </div>
          
          {info.data?.role === "STUDENT" && (
            <>
              <FormField label="Roll Number" error={errors.roll_number}>
                <Input
                  type="text"
                  placeholder="e.g. 21A91A0501"
                  value={form.roll_number}
                  onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
                />
              </FormField>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Course" error={errors.course}>
                  <Select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                    <option value="B.Tech">B.Tech</option>
                    <option value="M.Tech">M.Tech</option>
                    <option value="MCA">MCA</option>
                    <option value="MBA">MBA</option>
                  </Select>
                </FormField>
                <FormField label="Branch" error={errors.branch}>
                  <Input
                    type="text"
                    placeholder="CSE"
                    value={form.branch}
                    onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  />
                </FormField>
                <FormField label="Section" error={errors.section}>
                  <Input
                    type="text"
                    placeholder="A"
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                  />
                </FormField>
              </div>
            </>
          )}'''
content = content.replace(old_form, new_form)

val_old = '''    if (!form.first_name) errs.first_name = "Required";
    if (!form.last_name) errs.last_name = "Required";
    if (!form.roll_number) errs.roll_number = "Required";'''
val_new = '''    if (!form.first_name) errs.first_name = "Required";
    if (!form.last_name) errs.last_name = "Required";
    if (info.data?.role === "STUDENT" && !form.roll_number) errs.roll_number = "Required";'''
content = content.replace(val_old, val_new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
