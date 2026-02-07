"""
Authentication dependencies for FastAPI routes
Provides reusable authentication checks
"""

from fastapi import Request, HTTPException, status
from typing import Dict


async def get_current_user(request: Request) -> Dict:
    """
    Dependency to get the current authenticated user
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(user: Dict = Depends(get_current_user)):
            user_id = user["_id"]
            ...
    
    Raises:
        HTTPException: 401 if user is not authenticated
    
    Returns:
        Dict: User object from database
    """
    user = request.state.user
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_user_optional(request: Request) -> Dict | None:
    """
    Optional authentication - returns user if authenticated, None otherwise
    Does not raise exception if not authenticated
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(user: Dict = Depends(get_current_user_optional)):
            if user:
                # Authenticated user
                pass
            else:
                # Anonymous user
                pass
    """
    return request.state.user
