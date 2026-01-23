from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt
from database import get_db
from bson import ObjectId


import os
SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None

        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
            print(token)

            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                print(payload)
                user_id = payload.get("id") 
                print(user_id) # 👈 MATCH NODE

                if user_id:
                    with get_db() as db:
                        print(db.name)
                        user = db.users.find_one({"_id": ObjectId(user_id)})
                        print(user)
                        if user:
                            user["_id"] = str(user["_id"])
                            request.state.user = user
            except Exception:
                pass

        return await call_next(request)
