import os
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client
from google import genai
from google.genai import types
from zoneinfo import ZoneInfo

# --- 環境設定 ---
BASE_DIR = Path(__file__).resolve().parent.parent
env_local = BASE_DIR / ".env.local"
env_file = BASE_DIR / ".env"

if env_local.exists():
    load_dotenv(env_local)
elif env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()

# --- Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Supabase の URL またはシークレットキー(SUPABASE_SECRET_KEY)が設定されていません。")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# --- Buckets ---
BUCKET_NAME = "post_photos"
TIMELAPSE_BUCKET = "timelapses"

# --- Gemini ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEYが設定されていません。")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "gemini-2.5-flash"

# --- 定数 ---
JST = ZoneInfo("Asia/Tokyo")
IMAGE_DURATION = 1.5  # タイムラプスの画像表示時間