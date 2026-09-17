import os

with open('app/api/v1/admin/invitations.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'results.append({"email": email, "ok": True, "message": "Invitation sent"})',
    'res = await service.invite(email, user, ip=client_ip(request))\n            results.append({"email": email, "ok": True, "message": "Invitation sent", "setup_url": res.get("setup_url")})'
)

# Wait, the original code had:
# await service.invite(email, user, ip=client_ip(request))
# results.append({"email": email, "ok": True, "message": "Invitation sent"})

content = content.replace(
    'await service.invite(email, user, ip=client_ip(request))\n            results.append({"email": email, "ok": True, "message": "Invitation sent"})',
    'res = await service.invite(email, user, ip=client_ip(request))\n            results.append({"email": email, "ok": True, "message": "Invitation sent", "setup_url": res.get("setup_url")})'
)

with open('app/api/v1/admin/invitations.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated bulk invite")
