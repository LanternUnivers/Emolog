import datetime
import io
import tempfile
import numpy as np
import moviepy.editor as mpy
from PIL import Image
from fastapi import APIRouter, Form, HTTPException

# config.py からクライアントと定数をインポート
from config import supabase, JST, BUCKET_NAME, TIMELAPSE_BUCKET, IMAGE_DURATION

router = APIRouter()

@router.post("/generate-timelapse")
async def create_timelapse(
    user_id: str = Form(...), 
    year: int = Form(...), 
    month: int = Form(...)
):
    try:
        # 1. 対象月の投稿を取得 (JST基準)
        start_date = datetime.datetime(year, month, 1, tzinfo=JST)
        if month == 12:
            end_date = datetime.datetime(year + 1, 1, 1, tzinfo=JST)
        else:
            end_date = datetime.datetime(year, month + 1, 1, tzinfo=JST)
        
        utc_start = start_date.astimezone(datetime.timezone.utc)
        utc_end = end_date.astimezone(datetime.timezone.utc)

        res = supabase.table("posts").select("file_path, user_caption") \
            .eq("user_id", user_id) \
            .gte("created_at", utc_start.isoformat()) \
            .lt("created_at", utc_end.isoformat()) \
            .order("created_at", desc=False) \
            .execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="対象月の写真がありません。")

        # 2. 画像をStorageからダウンロードし、Numpy配列に
        image_frames = []
        for post in res.data:
            try:
                image_bytes = supabase.storage.from_(BUCKET_NAME).download(post['file_path'])
                img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
                image_frames.append(np.array(img))
            except Exception as e:
                print(f"Failed to load image: {post['file_path']}, {e}")
                continue
        
        if not image_frames:
             raise HTTPException(status_code=500, detail="画像の読み込みに失敗しました。")

        # 3. MoviePyで動画を生成 (1280x720 / 16:9)
        output_size = (1280, 720) # 16:9
        
        clips = []
        for frame in image_frames:
            img_clip = mpy.ImageClip(frame, duration=IMAGE_DURATION)
            
            img_clip_resized = img_clip.resize(width=output_size[0])
            if img_clip_resized.h > output_size[1]:
                img_clip_resized = img_clip.resize(height=output_size[1])

            background = mpy.ColorClip(size=output_size, color=(0,0,0), duration=IMAGE_DURATION)
            
            final_video_clip = mpy.CompositeVideoClip([
                background,
                img_clip_resized.set_position(('center', 'center'))
            ])
            clips.append(final_video_clip)

        if not clips:
             raise HTTPException(status_code=500, detail="動画クリップの生成に失敗しました。")

        final_clip = mpy.concatenate_videoclips(clips)
        final_clip.fps = 10 

        # 4. 動画を一時ファイルに書き出し
        output_filename = f"{user_id}/{year:04d}-{month:02d}.mp4"

        with tempfile.NamedTemporaryFile(delete=True, suffix=".mp4") as tmp_video_file:
            final_clip.write_videofile(
                tmp_video_file.name, 
                codec='libx264', 
                preset='ultrafast', 
                bitrate="1500k", 
                fps=10, 
                threads=2, 
                logger=None, 
                audio=False
            )
            tmp_video_file.seek(0)
            video_bytes = tmp_video_file.read()

        # 5. Storage (timelapsesバケット) にアップロード
        supabase.storage.from_(TIMELAPSE_BUCKET).upload(
            file=video_bytes,
            path=output_filename,
            file_options={"content-type": "video/mp4", "upsert": "true"}
        )
        
        # 6. 公開URLを返す
        public_url = supabase.storage.from_(TIMELAPSE_BUCKET).get_public_url(output_filename)
        
        return {"url": public_url}

    except Exception as e:
        print(f"Error generating timelapse: {e}")
        raise HTTPException(status_code=500, detail=str(e))