import datetime
from fastapi import APIRouter, HTTPException

# config.py からクライアントと定数をインポート
from config import supabase, JST

router = APIRouter()

@router.get("/user-stats")
async def get_user_stats(user_id: str):
    # 指定されたユーザーIDの投稿数と、JST基準での連続投稿日数を計算する。
    try:
        # 1. 投稿数をカウント
        count_res = supabase.table("posts").select("id", count="exact").eq("user_id", user_id).execute()
        post_count = count_res.count
        
        # 2. 連続投稿日数を計算
        posts_res = supabase.table("posts").select("created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        
        if not posts_res.data:
            return {
                "post_count": 0,
                "streak_days": 0
            }

        # 3. UTCタイムスタンプをJSTの日付(date)に変換し、Setに格納
        unique_jst_dates = set()
        for post in posts_res.data:
            try:
                utc_dt = datetime.datetime.fromisoformat(post['created_at'].replace('Z', '+00:00'))
                jst_date = utc_dt.astimezone(JST).date()
                unique_jst_dates.add(jst_date)
            except Exception:
                continue # 不正な日付フォーマットは無視
        
        # 4. ストリーク計算
        streak = 0
        today_jst = datetime.datetime.now(JST).date()
        
        current_date = today_jst
        if today_jst not in unique_jst_dates:
            current_date = today_jst - datetime.timedelta(days=1)
        
        while current_date in unique_jst_dates:
            streak += 1
            current_date -= datetime.timedelta(days=1)

        return {
            "post_count": post_count,
            "streak_days": streak 
        }

    except Exception as e:
        print(f"Error fetching user stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user stats: {str(e)}")