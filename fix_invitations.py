import os

path = r"d:\Projects\PBC\frontend\src\features\admin\InvitationsPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add role state
content = content.replace(
    'const [email, setEmail] = useState("");',
    'const [email, setEmail] = useState("");\n  const [role, setRole] = useState("STUDENT");'
)
# Update single invite
content = content.replace(
    'inviteSingle.mutate({ email, phone: phone || undefined }, {',
    'inviteSingle.mutate({ email, phone: phone || undefined, role }, {'
)

# Update bulk invite
content = content.replace(
    'inviteBulk.mutate({ emails: parsed }, {',
    'inviteBulk.mutate({ emails: parsed, role }, {'
)

# Replace Select component import if missing
if 'Select' not in content:
    content = content.replace('Input } from', 'Input, Select } from')

# Add role dropdown to single
old_single = '''              <div className="space-y-3">
                <FormField label="Student email" error={singleError}>'''
new_single = '''              <div className="space-y-3">
                <FormField label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="STUDENT">Student</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </Select>
                </FormField>
                <FormField label="Email address" error={singleError}>'''
content = content.replace(old_single, new_single)

# Add role dropdown to bulk
old_bulk = '''              <div className="space-y-3">
                <FormField label="Email addresses" error={bulkError}>'''
new_bulk = '''              <div className="space-y-3">
                <FormField label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="STUDENT">Student</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </Select>
                </FormField>
                <FormField label="Email addresses" error={bulkError}>'''
content = content.replace(old_bulk, new_bulk)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
