'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import AuthGuard from '../../lib/AuthGuard';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

// バックエンドAPIのURL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 歯車アイコン (変更なし)
const SettingsIcon = ({ onClick }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const className = isHovered
        ? `${styles['settings-icon']} ${styles['settings-icon-hover']}`
        : styles['settings-icon'];

    const handleClick = (e) => {
        e.preventDefault();
        onClick();
    };

    return (
        <a
            href="#"
            className={className}
            title="設定"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
            ⚙️
        </a>
    );
};

// 設定画面コンポーネント (ログアウト機能, 変更なし)
const SettingsPage = ({ onGoBack }) => {
    const router = useRouter();

    const handleLogout = async () => {
        if (confirm('本当にログアウトしますか？')) {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                
                localStorage.removeItem('access_token');
                router.push('/login');
            } catch (error) {
                console.error('Logout failed:', error);
                alert(`ログアウトに失敗しました: ${error.message}`);
            }
        }
    };

    return (
        <div className={styles['settings-container']}>
            <h2 className={styles['settings-title']}>設定</h2>

            <button
                className={`${styles['edit-button']} ${styles['mb-20']}`}
                onClick={onGoBack}
            >
                ← プロフィールに戻る
            </button>


            <div className={styles['settings-item']}>
                <h3>ログアウト</h3>
                <p>現在のセッションからサインアウトします。</p>
                <button
                    className={styles['settings-danger-button']}
                    onClick={handleLogout}
                >
                    ログアウト
                </button>
            </div>              

        </div>
    );
};


// --- (ここからが主な変更点です) ---

// メインのプロフィール表示コンポーネント
const MyProfile = ({ onNavigateToSettings }) => {
    const [userId, setUserId] = useState(null);
    const [profile, setProfile] = useState({
        username: '読み込み中...',
        bio: '',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    });
    
    // 編集モード用のState
    const [isEditing, setIsEditing] = useState(false);
    const [editUsername, setEditUsername] = useState('');
    const [editBio, setEditBio] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Supabaseからユーザー情報とプロフィール情報を取得
    useEffect(() => {
        let mounted = true;
        const fetchUserAndProfile = async () => {
            try {
                // 1. 認証ユーザー(ID)を取得
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (!user || authError) {
                    if (mounted) console.error("ユーザー情報の取得エラー:", authError?.message);
                    return;
                }
                
                if (mounted) {
                    setUserId(user.id);

                    // 2. バックエンドAPI に GET リクエストを送信
                    const profileEndpoint = `${API_BASE_URL}/profile/${encodeURIComponent(user.id)}`;
                    const res = await fetch(profileEndpoint);
                    
                    if (res.ok) {
                        const profileData = await res.json();
                        
                        // メールアドレスから生成した名前をフォールバックとして使用
                        const fallbackUsername = user.email ? user.email.split('@')[0] : 'ユーザー';
                        
                        if (mounted) {
                            setProfile(prev => ({ 
                                ...prev, 
                                username: profileData.username || fallbackUsername,
                                bio: profileData.bio || '自己紹介が未設定です。',
                                // TODO: avatar_url の処理
                            }));
                            // 編集フォームの初期値もセット
                            setEditUsername(profileData.username || fallbackUsername);
                            setEditBio(profileData.bio || '');
                        }
                    } else {
                         // プロファイル取得失敗（RLSなど）
                        console.warn('Failed to fetch profile', res.status);
                        const fallbackUsername = user.email ? user.email.split('@')[0] : 'ユーザー';
                         if (mounted) {
                            setProfile(prev => ({ ...prev, username: fallbackUsername, bio: 'プロフィールの読込失敗' }));
                         }
                    }
                }

            } catch (err) {
                 if (mounted) {
                     console.error("プロフィール取得中に予期せぬエラー:", err);
                     setProfile(prev => ({ ...prev, username: 'エラー', bio: err.message }));
                 }
            }
        };

        fetchUserAndProfile();
        return () => { mounted = false; };
    }, []);
    
    // 保存処理
    const handleSave = async (e) => {
        e.preventDefault();
        if (!userId) return;
        setIsLoading(true);
        
        try {
            const profileEndpoint = `${API_BASE_URL}/profile/${encodeURIComponent(userId)}`;
            
            const res = await fetch(profileEndpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: editUsername,
                    bio: editBio
                })
            });
            
            const updatedProfile = await res.json();
            
            if (!res.ok) {
                throw new Error(updatedProfile.detail || '更新に失敗しました');
            }
            
            // 表示用のStateを更新
            setProfile(prev => ({
                ...prev,
                username: updatedProfile.username,
                bio: updatedProfile.bio
            }));
            
            // 編集モードを終了
            setIsEditing(false);

        } catch (err) {
            console.error("更新エラー:", err);
            alert(`更新に失敗しました: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    // キャンセル処理
    const handleCancel = () => {
        // フォームの値を元の状態に戻す
        setEditUsername(profile.username);
        setEditBio(profile.bio);
        setIsEditing(false);
    };

    const showCameraIcon = profile.photoUrl.includes('data:image/png');

    return (
        <div className={styles['settings-container']}>
            <SettingsIcon onClick={onNavigateToSettings} />
            <div className={styles['profile-header']}>
                {/* --- プロフィール写真エリア --- */}
                <div className={styles['profile-photo-area']}>
                    <img 
                        src={profile.photoUrl} 
                        alt="プロフィール写真" 
                        className={styles['profile-photo']}
                        title="プロフィール写真" 
                    />
                    {showCameraIcon && <span className={styles['camera-icon']}>📸</span>}
                </div>

                {/* --- 情報エリア --- */}
                <div className={styles['profile-info-area']}>
                    
                    {/* --- 編集モードでない場合（isEditing === false） --- */}
                    {!isEditing && (
                        <>
                            <div className={styles['user-actions']}>
                                <h2 className={styles['username']}>{profile.username}</h2>
                                <button 
                                    className={styles['edit-button']}
                                    onClick={() => setIsEditing(true)}
                                >
                                    プロフィールを編集
                                </button>
                            </div>
                            <p className={styles['bio-text']}>{profile.bio}</p>
                        </>
                    )}
                    
                    {/* --- 編集モードの場合（isEditing === true） --- */}
                    {isEditing && (
                        <form className={styles['edit-form']} onSubmit={handleSave}>
                            <div className={styles['form-group']}>
                                <label htmlFor="username">ユーザー名</label>
                                <input 
                                    id="username"
                                    className={styles['form-input']}
                                    value={editUsername}
                                    onChange={(e) => setEditUsername(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className={styles['form-group']}>
                                <label htmlFor="bio">自己紹介</label>
                                <textarea
                                    id="bio"
                                    className={`${styles['form-input']} ${styles['form-textarea']}`}
                                    value={editBio}
                                    onChange={(e) => setEditBio(e.target.value)}
                                    disabled={isLoading}
                                    rows={4}
                                />
                            </div>
                            
                            <button 
                                type="submit" 
                                className={styles['save-button']} 
                                disabled={isLoading}
                            >
                                {isLoading ? '保存中...' : '保存'}
                            </button>
                            <button 
                                type="button"
                                className={`${styles['edit-button']} ${styles['ml-10']}`}
                                onClick={handleCancel}
                                disabled={isLoading}
                            >
                                キャンセル
                            </button>
                        </form>
                    )}
                    
                </div>
            </div>            
        </div>
    );
};

// ページ全体をラップするラッパー
export default function SettingsWrapper() {
  const [view, setView] = React.useState('profile'); 

  return (
    <AuthGuard>
      <div className={styles['settings-page']}>
        {view === 'profile' ? (
          <MyProfile onNavigateToSettings={() => setView('settings')} />
        ) : (
          <SettingsPage onGoBack={() => setView('profile')} />
        )}
      </div>
    </AuthGuard>
  );
}