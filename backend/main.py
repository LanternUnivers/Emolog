import os
import io
import time
import base64
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

from supabase import create_client, Client
from PIL import Image

from google import genai
from google.genai import types

# -----------------
# 1. 環境設定と初期化
# -----------------
# .env/.env.local をプロジェクトルートから読み込む（backend ディレクトリから起動しても動作するように）
BASE_DIR = Path(__file__).resolve().parent.parent
env_local = BASE_DIR / ".env.local"
env_file = BASE_DIR / ".env"

if env_local.exists():
    load_dotenv(env_local)
elif env_file.exists():
    load_dotenv(env_file)
else:
    load_dotenv()

# 環境変数から設定値を取得
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLIC_KEY = os.getenv("SUPABASE_PUBLIC_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# 必須の設定の検証
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Supabase の URL またはシークレットキー(SUPABASE_SECRET_KEY)が設定されていません。サーバー側は service_role（秘密鍵）を使用してください。")

# Supabaseクライアントの初期化
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("SupabaseのURLまたはシークレットキー(SUPABASE_SECRET_KEY)が設定されていません。")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

BUCKET_NAME = "post_photos"

# Geminiクライアントの初期化
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEYが設定されていません。")
gemini_client = genai.Client(api_key=GEMINI_API_KEY)
# 使用するモデル
GEMINI_MODEL = "gemini-2.5-flash"


app = FastAPI()

# -----------------
# 2. CORSミドルウェア
# -----------------
# フロントエンド(localhost:3000)からのアクセスを許可
origins = [
    "http://localhost:3000",
    "https://emolog-psi.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # 全てのHTTPメソッドを許可
    allow_headers=["*"], # 全てのHTTPヘッダーを許可
)

# -----------------
# 4. コア機能：AI分析と保存エンドポイント
# -----------------
# 写真ファイルとユーザーIDを受け取り、AI分析してDBに保存
@app.post("/analyze-and-save")
async def analyze_and_save(
    image: UploadFile = File(...),
    user_id: str = Form(...),
):
    try:
        # 1. 画像ファイルをメモリ上に読み込む
        image_data = await image.read()
        pil_image = Image.open(io.BytesIO(image_data))
        
        # 2. Geminiへのプロンプト定義
        prompt = (
            "あなたはプロの感情分析AIです。この写真を見て、ユーザーがどんな感情を抱いているか分析してください。"
            "そして、その感情を表現する日記のコメントを、親しみやすい文体で日本語で30文字程度で生成してください。"
            "回答は必ずJSON形式で、キーを 'emotion' (分析した感情), 'comment' (生成したコメント) としてください。"
            "例: {\"emotion\": \"楽しそう\", \"comment\": \"最高の一日！こんな日はいつまでも続いてほしいな。\"}"
        )
        
        # 3. Gemini APIの呼び出し
        gemini_response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[prompt, pil_image], # プロンプトと画像の両方を渡す
            config=types.GenerateContentConfig(
                response_mime_type="application/json", # JSON形式の出力を要求
                # response_schemaを定義することも可能だが、ここではMIME Type指定でシンプルに
            ),
        )

        # 4. GeminiのJSONレスポンスをパース
        # レスポンステキストはJSON形式になっているはず
        import json
        analysis_result = json.loads(gemini_response.text)
        emotion_text = analysis_result.get("emotion", "分析不能")
        comment_text = analysis_result.get("comment", "日記コメント生成失敗")

        # 5. 画像をSupabase Storageにアップロード
        file_path = f"{user_id}/{int(time.time())}_{image.filename}"
        
        # Storageにアップロード
        supabase.storage.from_(BUCKET_NAME).upload(
            file=image_data, 
            path=file_path, 
            file_options={"content-type": image.content_type}
        )
        
        # アップロードした画像の公開URLを取得（RSLポリシー設定が必要な場合あり）
        image_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)

        # 6. 分析結果とURLをSupabase Databaseに保存
        data, count = supabase.table("posts").insert({
            "user_id": user_id,
            "emotion": emotion_text,
            "comment": comment_text,
            "image_url": image_url,
            "file_path": file_path,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }).execute()

        # 7. 成功レスポンスをフロントエンドに返す
        return {
            "message": "Analysis successful and data saved",
            "emotion": emotion_text,
            "comment": comment_text,
            "image_url": image_url
        }

    except Exception as e:
        # エラーログを出力し、フロントエンドにHTTP 500エラーを返す
        print(f"An error occurred: {e}")
        # 詳細なエラー情報はログに残し、フロントエンドには一般的なメッセージを返す
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


# -----------------
#  ヘルスチェック
# -----------------
@app.get("/")
def read_root():
    return {"status": "ok", "service": "Emolog Backend"}

# -----------------
# 6. 日記表示用のAPI
# -----------------

@app.get("/photos")
async def get_user_diaries(user_id: str):
    """
    指定されたユーザーIDの全投稿（写真とAI分析結果）をDBから取得し、URLをそのまま使用する。
    """
    try:
        # DBから投稿データを取得
        # 'image_url' には公開 URL が保存されている前提とする
        res = supabase.table("posts").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        photos_data = []

        for post in res.data:
            date_obj = post.get("created_at")
            
            # 💡 修正点: created_atはISO 8601形式 (YYYY-MM-DDTHH:MM:SSZ) なので、
            # 'T' または ' ' で分割して日付部分 (YYYY-MM-DD) のみを取得
            date_only = ""
            if date_obj:
                # 'T' または ' ' で分割し、最初の要素(日付)を取得
                date_only = date_obj.split("T")[0].split(" ")[0]
            else:
                date_only = time.strftime("%Y-%m-%d")
            
            # 💡 修正: データベースに保存されている Public URL (image_url) をそのまま使用
            final_image_url = post["image_url"] 

            photos_data.append({
                "id": post["id"],
                "date": date_only, # <-- YYYY-MM-DD 形式
                "url": final_image_url,
                "caption": f"AI分析: {post.get('emotion', 'N/A')} - {post.get('comment', 'N/A')}",
            })
        
        return photos_data

    except Exception as e:
        print(f"Error fetching diaries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch diary data: {str(e)}")
    
# jphacks/tk_b_2510/.../backend/main.py

# -----------------
# 9. ユーザー統計情報取得API (P4タスク)
# -----------------
@app.get("/user-stats")
async def get_user_stats(user_id: str):
    """
    指定されたユーザーIDの投稿数を取得する。
    連続投稿日数の計算は複雑なため、一旦フロントエンドのモック値を維持する。
    """
    try:
        # Supabaseの'posts'テーブルから、指定された user_id の投稿数をカウント
        # select('*', count='exact') で件数を取得し、データ本体は取得しない
        res = supabase.table("posts").select("id", count="exact").eq("user_id", user_id).execute()
        
        post_count = res.count # exact count を取得
        
        # 連続投稿日数は、まだサーバーサイドでの正確な計算が複雑なため、
        # フロントエンドがモック値を使用できるように 365 を返却
        return {
            "post_count": post_count,
            "streak_days": 365 # 仮の値 (フロントエンドのモック値に依存)
        }

    except Exception as e:
        print(f"Error fetching user stats: {e}")
        # エラー時は 0 を返す
        raise HTTPException(status_code=500, detail=f"Failed to fetch user stats: {str(e)}")