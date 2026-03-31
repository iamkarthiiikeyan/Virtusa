"""Application configuration via environment variables."""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

# Server
HOST = os.getenv("ATLAS_HOST", "0.0.0.0")
PORT = int(os.getenv("ATLAS_PORT", "8000"))

# CORS
ALLOWED_ORIGINS = os.getenv(
    "ATLAS_CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
).split(",")

# LLM (optional - agents work without it)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
LLM_ENABLED = bool(OPENAI_API_KEY)

# Cache
CACHE_DIR = BASE_DIR.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# OSMnx cache
OSMNX_CACHE_DIR = CACHE_DIR / "osmnx"
OSMNX_CACHE_DIR.mkdir(exist_ok=True)
