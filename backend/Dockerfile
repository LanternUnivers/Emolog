# ベースイメージとしてPythonの公式軽量イメージを使用
FROM python:3.11-slim

# 作業ディレクトリを /app に設定
WORKDIR /app

# 環境変数を設定（Uvicornが本番モードで動くように）
ENV PYTHONUNBUFFERED 1
ENV FASTAPI_ENV "production"

# FFMPEFGとその依存関係をインストール
RUN apt-get update && apt-get install -y ffmpeg libsm6 libxext6 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 依存関係をインストール
# requirements.txtをコピー
COPY requirements.txt .

# 依存関係をインストール
# --no-cache-dir はキャッシュを使わないことでイメージサイズを削減
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションのコードをコピー
# main.py やその他の必要なファイル、フォルダを全て /app にコピー
COPY . .

# アンテナを立てるポート（FastAPIのデフォルトポート）を公開
EXPOSE 8000

# サーバー起動コマンド
# Uvicornを使い、本番環境向けのワーカー設定で実行
# 'main:app' は main.py ファイル内の app インスタンスを指す
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]