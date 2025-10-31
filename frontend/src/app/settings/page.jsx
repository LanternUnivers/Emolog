'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import AuthGuard from '../../lib/AuthGuard';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';

// 歯車アイコン
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

// 設定画面コンポーネント
const SettingsPage = ({ onGoBack }) => {
    const router = useRouter();

    // ログアウト処理
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

// メインのプロフィール表示コンポーネント
const MyProfile = ({ onNavigateToSettings }) => {
    const [profile, setProfile] = React.useState({
        username: '読み込み中...',
        bio: '写真を撮るのが好きです。旅行とグルメが趣味です。🌍🍜',
        photoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    });
    
    // Supabaseからユーザー情報を取得
    React.useEffect(() => {
        let mounted = true;
        const fetchUser = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();

                if (error && mounted) {
                    console.error("ユーザー情報の取得エラー:", error.message);
                    setProfile(prev => ({ ...prev, username: 'エラー' }));
                    return;
                }

                if (user && mounted) {
                    const email = user.email;
                    let newUsername = email ? email.split('@')[0] : (user.user_metadata?.full_name || 'ユーザー名未設定');
                    
                    setProfile(prev => ({ 
                        ...prev, 
                        username: newUsername,
                    }));
                } else if (mounted) {
                    setProfile(prev => ({ ...prev, username: 'ゲスト' }));
                }
            } catch (err) {
                 if (mounted) {
                     console.error("ユーザー情報取得中に予期せぬエラー:", err);
                     setProfile(prev => ({ ...prev, username: 'エラー' }));
                 }
            }
        };

        fetchUser();
        return () => { mounted = false; };
    }, []);
    
    const showCameraIcon = profile.photoUrl.includes('data:image/png');

    return (
        <div className={styles['settings-container']}>
            <SettingsIcon onClick={onNavigateToSettings} />
            <div className={styles['profile-header']}>
                <div className={styles['profile-photo-area']}>
                    <img 
                        src={profile.photoUrl} 
                        alt="プロフィール写真" 
                        className={styles['profile-photo']}
                        title="プロフィール写真" 
                    />
                    {showCameraIcon && <span className={styles['camera-icon']}>📸</span>}
                </div>

                <div className={styles['profile-info-area']}>
                    <div className={styles['user-actions']}>
                        <h2 className={styles['username']}>{profile.username}</h2>
                    </div>
                    <p className={styles['bio-text']}>{profile.bio}</p>
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