'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import styles from './page.module.css';
import AuthGuard from '../../lib/AuthGuard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_ENDPOINT = `${API_BASE_URL}/analyze-and-save`;

// 💡 ResultModalコンポーネント
const ResultModal = ({ data, onClose }) => {
    const { emotion, comment } = data;

    const emotionClass = (e) => {
        if (e.includes('楽し') || e.includes('喜')) return 'emotion-happy';
        if (e.includes('悲し')) return 'emotion-sad';
        if (e.includes('怒り') || e.includes('不満')) return 'emotion-anger';
        if (e.includes('穏や') || e.includes('落ち着')) return 'emotion-calm';
        return 'emotion-default';
    };

    return (
        <div className={styles['result-modal-overlay']} onClick={onClose}>
            <div className={`${styles['result-modal-card']} ${styles[emotionClass(emotion)]}`} onClick={(e) => e.stopPropagation()}>
                <button className={styles['close-button']} onClick={onClose}>✕</button>
                <div className={styles['result-icon']}>
                    {emotion.includes('楽し') || emotion.includes('喜') ? '🎉' :
                     emotion.includes('悲し') ? '😢' :
                     emotion.includes('怒り') || emotion.includes('不満') ? '😡' :
                     emotion.includes('穏や') || emotion.includes('落ち着') ? '😌' :
                     '✨'}
                </div>
                <h3 className={styles['result-title']}>感情を記録しました！</h3>
                <p className={styles['result-emotion']}>あなたの気持ち: <span>{emotion}</span></p>
                
                <div className={styles['ai-comment-box']}>
                    <p className={styles['ai-comment-label']}>AIのコメント:</p>
                    <p className={styles['ai-comment-text']}>『{comment}』</p>
                </div>

                <div className={styles['result-footer']}>
                    <button className={styles['ok-button']} onClick={onClose}>閉じる</button>
                </div>
            </div>
        </div>
    );
};


const PostPage = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [caption, setCaption] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState(null);
    const [resultData, setResultData] = useState(null);

    // 認証状態の監視とユーザーIDの設定
    useEffect(() => {
        let mounted = true;

        // 1. 認証状態の変化を監視するリスナーを登録
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (mounted) {
                    setUserId(session ? session.user.id : null);
                }
            }
        );

        // 2. ページロード時にも現在のセッションを非同期で確認
        // (リスナーが発火する前の初期ロード用)
        const checkCurrentSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (mounted && session && !error) {
                setUserId(session.user.id);
            }
        };

        checkCurrentSession();

        // 3. クリーンアップ関数
        return () => {
            mounted = false;
            subscription?.unsubscribe(); // 'subscription' オブジェクトの unsubscribe を呼ぶ
        };
    }, []); // 依存配列は空のまま（マウント時に1回だけ登録）

    // ファイル選択ハンドラ (変更なし)
    const handleFileChange = (event) => {
        const file = event.target.files && event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setSelectedFile(null);
            setPreviewUrl('');
        }
    };

    // 投稿ハンドラ (変更なし)
    const handleSubmit = async () => {
        if (!selectedFile) {
            alert('写真をアップロードしてください。');
            return;
        }
        
        if (!userId) {
             alert('ユーザー情報が取得できませんでした。ログイン状態を確認してください。');
             return;
        }

        setIsLoading(true);

        const formData = new FormData();
        formData.append('image', selectedFile, selectedFile.name);
        formData.append('user_id', userId); 

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || 'バックエンド処理中にエラーが発生しました');
            }

            setResultData(result);
            setSelectedFile(null);
            setPreviewUrl('');
            setCaption('');
        
        } catch (error) {
            console.error('投稿エラー:', error);
            alert(`🚨 投稿に失敗しました。\nエラー詳細: ${error.message || '不明なエラー'}`);
        } finally {
            setIsLoading(false);
        }

    }


    return (
        <div className={`${styles.postPage} ${styles.postContainer}`}>
            
            <h2 className={styles.postTitle}>今日の感情を記録する</h2>
            <div className={styles.photoArea}>
                {previewUrl ? (
                    <img src={previewUrl} alt="プレビュー画像" className={styles.previewImage} />
                ) : (
                    <label htmlFor="photo-upload" className={styles.uploadLabel}>
                        📸 写真を選択・撮影
                    </label>
                )}

                <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </div>

            <div className={styles.captionArea}>
                <label htmlFor="caption" className={styles.captionLabel}>
                    📝 コメント（optional）
                </label>
                <textarea
                    id="caption"
                    className={styles.captionTextarea}
                    placeholder="写真にまつわる気持ちを書いてみましょう..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={isLoading}
                />
            </div>

            <button
                className={styles.submitButton} 
                onClick={handleSubmit}
                disabled={!selectedFile || isLoading || !userId}
            >
                {isLoading ? '感情を読み取り中...' : '世界を育てる✨'}
            </button>

            {isLoading && (
                <div className={styles['loading-overlay']}>
                    <p>感情を読み取っています...</p>
                </div>
            )}

            {resultData && (
                <ResultModal data={resultData} onClose={() => setResultData(null)} />
            )}
        </div>
    );
};

export default function PhotoPageWrapper() {
    return (
        <AuthGuard>
            <PostPage />
        </AuthGuard>
    );
}