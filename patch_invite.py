with open('app/services/invitation_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'return {"message": f"Invitation email sent to {email}"}',
    'return {"message": f"Invitation email sent to {email}", "setup_url": f"{_app_url()}/accept-invitation?token={raw_token}"}'
)

with open('app/services/invitation_service.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated invitation_service")
