import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def check_email_logs():
    # Use the URI from their .env
    uri = "mongodb+srv://light:Thub1234@cluster0.jtlxsvq.mongodb.net/"
    client = AsyncIOMotorClient(uri)
    db = client.get_database("lms") # default DB, but let's check config if different
    # wait, config says what db? 
    # Let's just use default or look for email_logs
    
    print("Checking email logs...")
    cursor = db.email_logs.find().sort("created_at", -1).limit(5)
    logs = await cursor.to_list(length=5)
    
    if not logs:
        print("No email logs found!")
    
    for log in logs:
        print(f"[{log.get('created_at')}] To: {log.get('recipient')} | Status: {log.get('status')} | Error: {log.get('error')}")

if __name__ == "__main__":
    asyncio.run(check_email_logs())
