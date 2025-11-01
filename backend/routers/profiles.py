from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

# config.py からクライアントをインポート
from config import supabase

router = APIRouter()

# --- Pydanticモデル定義 ---
class Profile(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    # avatar_url: Optional[str] = None # 将来的にアバター更新もここに追加可能

# --- APIエンドポイント ---

@router.get("/profile/{user_id}", response_model=Profile)
async def get_profile(user_id: str):
    # ユーザーIDに基づいてプロフィール情報を取得する
    try:
        res = supabase.table("profiles").select("username, bio, avatar_url").eq("id", user_id).single().execute()
        
        if not res.data:
            # テーブル設定により、rowは自動作成されるはずです
            # もし404になる場合、Supabaseダッシュボードで profiles テーブルの RLS (Row Level Security) ポリシーを確認してください。
            raise HTTPException(status_code=404, detail="Profile not found. Check RLS policies on 'profiles' table.")
        
        return res.data
    except Exception as e:
        print(f"Error get_profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/profile/{user_id}", response_model=Profile)
async def update_profile(user_id: str, profile_update: ProfileUpdate):
    # ユーザーIDに基づいてプロフィール情報（username, bio）を更新する
    try:
        # None のキーを除外し、NULL で上書きしないようにする
        update_data = profile_update.dict(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        res = supabase.table("profiles").update(update_data).eq("id", user_id).select("username, bio, avatar_url").single().execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Profile not found or update failed")
            
        return res.data
    except Exception as e:
        print(f"Error update_profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))