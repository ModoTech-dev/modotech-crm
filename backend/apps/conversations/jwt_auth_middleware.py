"""
Django Channels' built-in AuthMiddlewareStack authenticates WebSocket
connections using a Django session cookie — but this app authenticates
everywhere else with JWT access tokens, and never establishes a Django
session at all (LoginView only ever issues a token pair, it never calls
django.contrib.auth.login()). The practical effect: AuthMiddlewareStack
sees an anonymous user on every single connection, every one gets
rejected in InboxConsumer.connect(), and nothing ever updates live —
regardless of whether the person is genuinely logged in. This is what
actually caused an open conversation needing a manual refresh to show
a new message, rather than anything specific to that feature's own
code, which was already correct.

Browsers can't attach a custom Authorization header to a raw WebSocket
handshake, so the token travels as a query parameter instead:
wss://.../ws/inbox/?token=<jwt-access-token>. That's a standard,
accepted pattern for this exact limitation.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user_from_token(token: str):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    try:
        validated = AccessToken(token)
        return User.objects.get(id=validated["user_id"])
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = parse_qs(scope.get("query_string", b"").decode())
        token = query_string.get("token", [None])[0]
        scope["user"] = await _get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
