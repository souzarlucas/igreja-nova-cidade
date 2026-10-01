import asyncio
import hashlib
from backend import security


def test_password_hash_respects_worker_cap_and_verifies(monkeypatch):
    original = security.derive
    calls = []

    async def capped(password, salt, iterations):
        assert iterations <= 100_000
        calls.append(iterations)
        return await original(password, salt, iterations)

    monkeypatch.setattr(security, 'derive', capped)
    async def check():
        stored = await security.hash_password('A-long-test-password')
        assert sum(calls) == 600_000
        assert await security.verify_password('A-long-test-password', stored)
        assert not await security.verify_password('Wrong-password', stored)
        salt = stored.split('$')[2]
        value = 'A-long-test-password'
        for i in range(6):
            value = hashlib.pbkdf2_hmac('sha256', value.encode(), f'{salt}:{i}'.encode(), 100_000).hex()
        assert stored.split('$')[3] == value
    asyncio.run(check())
