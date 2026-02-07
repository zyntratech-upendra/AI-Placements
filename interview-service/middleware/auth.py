from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt, JWTError
from database import get_db
from bson import ObjectId
import logging
import os

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"

logger = logging.getLogger("backend.auth")

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None

        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]
            logger.debug(f"Token received: {token[:20]}...")

            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                logger.debug(f"JWT payload: {payload}")
                
                user_id = payload.get("id") 
                logger.debug(f"User ID from token: {user_id}")

                if user_id:
                    with get_db() as db:
                        logger.debug(f"Looking up user in database: {db.name}")
                        user = db.users.find_one({"_id": ObjectId(user_id)})
                        
                        if user:
                            logger.debug(f"User found: {user.get('email')}")
                            user["_id"] = str(user["_id"])
                            request.state.user = user
                        else:
                            logger.warning(f"User not found in database: {user_id}")
                else:
                    logger.warning("No user ID in JWT payload")
                    
            except JWTError as e:
                logger.error(f"JWT decode error: {e}")
            except Exception as e:
                logger.error(f"Auth middleware error: {e}", exc_info=True)

        return await call_next(request)
