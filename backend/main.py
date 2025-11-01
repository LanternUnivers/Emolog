from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# routers フォルダから各ルーターをインポート
from routers import posts, diaries, stats, timelapse, profiles

app = FastAPI()

# -----------------
# CORSミドルウェア
# -----------------
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
# ルーターの登録
# -----------------
# 各ファイルで定義したルーターをメインアプリに合体させる
app.include_router(posts.router, tags=["Posts"])
app.include_router(diaries.router, tags=["Diaries"])
app.include_router(stats.router, tags=["Stats"])
app.include_router(timelapse.router, tags=["Timelapse"])
app.include_router(profiles.router, tags=["Profiles"])

# -----------------
# 機能：ヘルスチェック
# -----------------
@app.get("/")
def read_root():
    return {"status": "ok", "service": "Emolog Backend"}