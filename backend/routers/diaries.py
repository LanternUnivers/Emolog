import datetime
from fastapi import APIRouter, HTTPException

# config.py からクライアントと定数をインポート
from config import supabase, JST

router = APIRouter()

@router.get("/photos")
async def get_user_diaries(user_id: str):
    # 指定されたユーザーIDの全投稿（写真とAI分析結果）をDBから取得し、URLをそのまま使用する。
    try:
        # DBから投稿データを取得
        res = supabase.table("posts").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        photos_data = []

        for post in res.data:
            date_obj_str = post.get("created_at")
            
            date_only = ""
            if date_obj_str:
                try:
                    utc_dt = datetime.datetime.fromisoformat(date_obj_str.replace('Z', '+00:00'))
                    # JSTに変換
                    jst_dt = utc_dt.astimezone(JST)
                    # JSTの日付を YYYY-MM-DD 形式で取得
                    date_only = jst_dt.strftime("%Y-%m-%d")
                except Exception:
                    date_only = date_obj_str.split("T")[0].split(" ")[0]
            
            final_image_url = post["image_url"]

            photos_data.append({
                "id": post["id"],
                "date": date_only,
                "url": final_image_url,
                "emotion": post.get("emotion", ""),
                "ai_comment": post.get("ai_comment", ""),
                "user_caption": post.get("user_caption", "") 
            })
        
        return photos_data
    
    except Exception as e:
        print(f"Error fetching diaries: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch diary data: {str(e)}")