import os
import io
import time
import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image
from google.genai import types

# config.py からクライアントと定数をインポート
from config import supabase, gemini_client, GEMINI_MODEL, BUCKET_NAME

router = APIRouter()

@router.post("/analyze-and-save")
async def analyze_and_save(
    image: UploadFile = File(...),
    user_id: str = Form(...),
    caption: str = Form(None),
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
            ),
        )

        # 4. GeminiのJSONレスポンスをパース
        analysis_result = json.loads(gemini_response.text)
        emotion_text = analysis_result.get("emotion", "分析不能")
        comment_text = analysis_result.get("comment", "日記コメント生成失敗")

        # 5. 画像をSupabase Storageにアップロード(安全なファイル名生成)
        file_extension = os.path.splitext(image.filename)[1]
        safe_filename = f"{int(time.time())}{file_extension}"
        file_path = f"{user_id}/{safe_filename}"
        
        # Storageにアップロード
        supabase.storage.from_(BUCKET_NAME).upload(
            file=image_data, 
            path=file_path, 
            file_options={"content-type": image.content_type}
        )
        
        image_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_path)

        # 6. 分析結果とURLをSupabase Databaseに保存
        data, count = supabase.table("posts").insert({
            "user_id": user_id,
            "emotion": emotion_text,
            "ai_comment": comment_text,
            "image_url": image_url,
            "file_path": file_path,
            "user_caption": caption
        }).execute()

        # 7. 成功レスポンスをフロントエンドに返す
        return {
            "message": "Analysis successful and data saved",
            "emotion": emotion_text,
            "comment": comment_text,
            "image_url": image_url
        }

    except Exception as e:
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")