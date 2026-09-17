import re

with open('frontend/src/layouts/PortalLayouts.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the Logo + Admin Console layout to be stacked
admin_logo_section_old = r'''        {/\* Logo section \*/}
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/logo.png" alt="Technical Hub" className="h-10 w-auto object-contain drop-shadow-sm" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-wide" style={{ color: "#ffffff" }}>Admin Console</p>
          </div>
          <button'''

admin_logo_section_new = r'''        {/* Logo section */}
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center relative">
          <img src="/logo.png" alt="Technical Hub" className="h-12 w-auto object-contain drop-shadow-sm" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-wide text-black">Admin Console</p>
          </div>
          <button
            className="absolute top-4 right-4 rounded-md p-1.5 lg:hidden text-black"'''

content = re.sub(r'        \{\/\* Logo section \*\/\}[\s\S]*?<button', admin_logo_section_new, content)

# Fix Student Logo + Portal Layout
student_logo_old = r'''          <NavLink to="/student/dashboard" className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="Technical Hub" 
              className="h-10 w-auto object-contain drop-shadow-sm" 
            />
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold leading-none" style={{ color: "#ffffff" }}>Student Portal</p>
            </div>
          </NavLink>'''

student_logo_new = r'''          <NavLink to="/student/dashboard" className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="Technical Hub" 
              className="h-10 w-auto object-contain drop-shadow-sm" 
            />
            <div className="hidden sm:block">
              <p className="text-sm font-extrabold leading-none text-black">Student Portal</p>
            </div>
          </NavLink>'''

content = content.replace(student_logo_old, student_logo_new)

# Replace all remaining color: "#ffffff" with text-black
content = content.replace('style={{ color: "#ffffff" }}', 'className="text-black"')
content = content.replace('style={{ color: "var(--text)" }}', 'className="text-black"')

# Replace text-white with text-black
content = content.replace('"text-white"', '"text-black"')
content = content.replace('text-white', 'text-black')

with open('frontend/src/layouts/PortalLayouts.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated PortalLayouts.tsx")
