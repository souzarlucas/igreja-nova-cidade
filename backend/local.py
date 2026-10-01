import os
from pathlib import Path
from dotenv import load_dotenv
from .database import LocalDatabase
from .app import create_app

load_dotenv(Path(__file__).parent.parent / ".dev.vars")
database = LocalDatabase(
    os.getenv(
        "DATABASE_PATH", str(Path(__file__).parent.parent / ".local/church.sqlite")
    )
)
database.migrate()
app = create_app(database)
