"""Security utility tests: hashing, tokens, opaque token generation."""
import time

import jwt as pyjwt

from app.config import settings
from app.core import security


def test_password_hash_roundtrip():
    hashed = security.hash_password("S3cure!pass")
    assert hashed != "S3cure!pass"
    assert security.verify_password("S3cure!pass", hashed)
    assert not security.verify_password("wrong", hashed)


def test_temp_password_meets_policy():
    for _ in range(20):
        pw = security.generate_temp_password()
        assert len(pw) >= 12
        assert any(c.isupper() for c in pw)
        assert any(c.islower() for c in pw)
        assert any(c.isdigit() for c in pw)
        assert any(c in "!@#$%" for c in pw)


def test_access_token_contains_role_and_version():
    token = security.create_access_token("user123", "STUDENT", token_version=3)
    payload = security.decode_token(token)
    assert payload["sub"] == "user123"
    assert payload["role"] == "STUDENT"
    assert payload["ver"] == 3
    assert payload["type"] == "access"


def test_expired_token_is_rejected():
    token = pyjwt.encode(
        {"sub": "u1", "type": "access", "exp": int(time.time()) - 100},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    assert security.decode_token(token) is None


def test_garbage_token_is_rejected():
    assert security.decode_token("not.a.token") is None


def test_refresh_token_type():
    token = security.create_refresh_token("user1", 0)
    payload = security.decode_token(token)
    assert payload["type"] == "refresh"
    assert payload["exp"] - payload["iat"] >= 6 * 24 * 3600


def test_reset_tokens_are_hashed_not_stored_plain():
    raw = security.generate_secure_token()
    hashed = security.hash_token(raw)
    assert raw not in hashed
    assert security.hash_token(raw) == hashed
