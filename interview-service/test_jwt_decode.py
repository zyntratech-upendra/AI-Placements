"""
Test JWT decoding to debug authentication issues
"""

import os
from jose import jwt
from bson import ObjectId
from database import get_mongodb_client

# Token from the logs
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NThhZmJlNWNiZWU4MjA1NjZjNzcwMiIsImlhdCI6MTc2NzY4NTk4NywiZXhwIjoxNzcwMjc3OTg3fQ.-bH0YkeKuODTgRLo_aERmYEZeGauJN87G1hF6f6AkMw"

JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

print("=" * 60)
print("JWT AUTHENTICATION DEBUG")
print("=" * 60)

print(f"\n1. JWT_SECRET exists: {bool(JWT_SECRET)}")
if JWT_SECRET:
    print(f"   JWT_SECRET (first 20 chars): {JWT_SECRET[:20]}...")

print(f"\n2. Decoding JWT token...")
try:
    payload = jwt.decode(TOKEN, JWT_SECRET, algorithms=[ALGORITHM])
    print(f"   ✅ JWT decoded successfully!")
    print(f"   Payload: {payload}")
    
    user_id = payload.get("id")
    print(f"\n3. User ID from payload: {user_id}")
    
    if user_id:
        print(f"\n4. Checking MongoDB...")
        db = get_mongodb_client()
        print(f"   Database name: {db.name}")
        print(f"   Collections: {db.list_collection_names()}")
        
        print(f"\n5. Looking up user with _id: {user_id}")
        try:
            user = db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                print(f"   ✅ User found!")
                print(f"   Email: {user.get('email')}")
                print(f"   Name: {user.get('firstName')} {user.get('lastName')}")
                print(f"   Role: {user.get('role')}")
            else:
                print(f"   ❌ User NOT found in database!")
                print(f"\n   Checking all users in database:")
                all_users = list(db.users.find({}, {"_id": 1, "email": 1}))
                print(f"   Total users: {len(all_users)}")
                for u in all_users[:5]:
                    print(f"     - _id: {u['_id']}, email: {u.get('email')}")
        except Exception as e:
            print(f"   ❌ Error looking up user: {e}")
            print(f"   Error type: {type(e).__name__}")
    else:
        print(f"   ❌ No 'id' field in JWT payload!")
        
except Exception as e:
    print(f"   ❌ Failed to decode JWT: {e}")
    print(f"   Error type: {type(e).__name__}")

print("\n" + "=" * 60)
