import hashlib, hmac, secrets
from datetime import datetime, timezone, timedelta


async def derive(password, salt, iterations):
    try:
        from js import crypto, Uint8Array, Object
        from pyodide.ffi import to_js
    except ImportError:
        return hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), iterations
        ).hex()
    key = await crypto.subtle.importKey(
        "raw",
        Uint8Array.new(to_js(list(password.encode()))),
        "PBKDF2",
        False,
        to_js(["deriveBits"]),
    )
    algorithm = to_js(
        {
            "name": "PBKDF2",
            "salt": Uint8Array.new(to_js(list(salt.encode()))),
            "iterations": iterations,
            "hash": "SHA-256",
        },
        dict_converter=Object.fromEntries,
    )
    bits = await crypto.subtle.deriveBits(algorithm, key, 256)
    return bytes(Uint8Array.new(bits).to_py()).hex()


async def hash_password(password):
    salt = secrets.token_hex(16)
    derived = await derive(password, salt, 600_000)
    return f"pbkdf2_sha256$600000${salt}${derived}"


async def verify_password(password, stored):
    try:
        if stored.startswith("pbkdf2_sha256$"):
            _, iterations, salt, value = stored.split("$")
            if not 100_000 <= int(iterations) <= 600_000:
                return False
            derived = await derive(password, salt, int(iterations))
        else:
            salt, value = stored.split(":")
            derived = await derive(password, salt, 100_000)
        return hmac.compare_digest(derived, value)
    except (ValueError, TypeError):
        return False


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def launch_allowed(deadline, now=None):
    now = now or datetime.now(timezone.utc)
    return now.astimezone(timezone(timedelta(hours=-4))).day <= deadline


def can_finance(user):
    return user["role"] == "admin" or bool(user.get("finance_access"))


def global_finance(user):
    return can_finance(user) and user["role"] in {"admin", "treasury", "presbytery"}


def can_write(role, kind):
    if role == "admin":
        return True
    if role == "treasury":
        return kind in {"budgets", "expenses", "incomes"}
    return role == "ministry" and kind in {"events", "requests"}
