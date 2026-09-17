import os

path = r"d:\Projects\PBC\frontend\src\features\admin\BatchesPage.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("toast.success(", "toast.push('success', ")
content = content.replace("toast.error(", "toast.push('error', ")
content = content.replace("isLoading={", "loading={")
content = content.replace("isDestructive", "tone=\"danger\"")
content = content.replace("description=\"Are you sure", "message=\"Are you sure")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

path_hooks = r"d:\Projects\PBC\frontend\src\api\hooks.ts"
with open(path_hooks, "r", encoding="utf-8") as f:
    hooks = f.read()

hooks = hooks.replace("mutationFn: createBatch", "mutationFn: (data: { batch_code: string; name: string; description?: string }) => createBatch(data)")
hooks = hooks.replace("mutationFn: deleteBatch", "mutationFn: (id: string) => deleteBatch(id)")

with open(path_hooks, "w", encoding="utf-8") as f:
    f.write(hooks)
