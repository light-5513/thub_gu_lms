import os

path = r"d:\Projects\PBC\frontend\src\layouts\PortalLayouts.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace AdminLayout min-h-screen with h-screen overflow-hidden
content = content.replace('className="flex min-h-screen" style={{ backgroundColor: "var(--bg)" }}', 'className="flex h-screen overflow-hidden bg-cream-100"')

# Fix Sidebar style
old_aside = '''      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          borderRight: "1px solid rgba(0, 0, 0, 0.40)",
          boxShadow: "var(--neo-out)",
        }}
      >'''
new_aside = '''      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col transition-transform lg:static lg:translate-x-0 lg:m-4 card !rounded-3xl border-0",
          sidebarOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full"
        )}
      >'''
content = content.replace(old_aside, new_aside)

# Fix Nav text color
content = content.replace('isActive ? "sk-nav-active" : "text-black"', 'isActive ? "sk-nav-active" : "text-leather-300"')
content = content.replace('<p className="text-sm font-extrabold tracking-wide text-black">', '<p className="text-sm font-extrabold tracking-wide text-leather-300">')
content = content.replace('lg:hidden text-black', 'lg:hidden text-leather-300')
content = content.replace('sm:hidden text-black', 'sm:hidden text-leather-300')
content = content.replace('text-black hover:bg-[rgba(255,255,255,0.06)]', 'text-leather-300 hover:bg-cream-200/50')
content = content.replace('text-black', 'text-leather-300')

# Fix Footer status box
old_footer = '''        <div
          className="m-3 rounded-2xl p-3"
          style={{
            background: "var(--bezel-deep)",
            border: "1px solid rgba(0, 0, 0, 0.40)",
            boxShadow: "var(--neo-in-deep-sm)",
          }}
        >'''
new_footer = '''        <div className="m-4 rounded-3xl p-4 card-inset border-0">'''
content = content.replace(old_footer, new_footer)

# Fix Main content overflow
content = content.replace('<main className="min-w-0 flex-1 p-4 lg:p-6">', '<main className="min-w-0 flex-1 p-4 lg:p-6 overflow-y-auto">')

# Fix Student Layout
content = content.replace('<div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>', '<div className="min-h-screen bg-cream-100">')

# Fix breadcrumb box shadow
old_crumb = '''          <div
            className="hidden md:flex items-center gap-2 rounded-2xl px-3 py-1.5"
            style={{
              background: "var(--bezel-deep)",
              boxShadow: "var(--neo-in-deep-sm)",
              border: "1px solid rgba(0, 0, 0, 0.40)",
            }}
          >'''
new_crumb = '''          <div className="hidden md:flex items-center gap-2 rounded-3xl px-4 py-2 card-inset border-0">'''
content = content.replace(old_crumb, new_crumb)

# Fix header user avatar
old_avatar = '''              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold"
              style={{
      
                border: "1px solid rgba(0, 0, 0, 0.50)",
                boxShadow: "var(--neo-out-sm)",
              }}'''
new_avatar = '''              className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold sk-icon-disc"'''
content = content.replace(old_avatar, new_avatar)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
