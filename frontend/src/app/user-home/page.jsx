"use client";

import React, { useEffect, useState } from "react";
import styles from "./page.module.css";
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import AuthGuard from '../../lib/AuthGuard';

export function HomePage() {
  const [username, setUsername] = useState('あなた');
  const [streakDays, setStreakDays] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true); 

        // 1. ユーザー情報を取得 (変更なし)
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          console.warn('supabase getUser error', error?.message || 'No user');
          if (mounted) {
            setUsername('あなた');
            setPostCount(0);
            setStreakDays(0);
            setLoading(false);
          }
          return;
        }
        
        const user = data.user;
        const email = user.email || 'あなた';
        const name = email.split('@')[0];
        if (mounted) setUsername(name);

        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        try {
          const profileEndpoint = `${API_BASE_URL}/profile/${encodeURIComponent(user.id)}`;
          const profileRes = await fetch(profileEndpoint);
          
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (mounted) {
              setUsername(profileData.username || fallbackUsername);
            }
          } else {
            // プロフィール取得失敗
            if (mounted) setUsername(fallbackUsername);
          }
        } catch (profileErr) {
          console.error('Error fetching /profile', profileErr);
          if (mounted) setUsername(fallbackUsername);
        }


        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const statsEndpoint = `${API_BASE_URL}/user-stats?user_id=${encodeURIComponent(user.id)}`;
            
            const statsRes = await fetch(statsEndpoint);
            
            if (statsRes.ok) {
                const statsData = await statsRes.json();
                if (mounted) {
                    // APIから返ってきた両方の値をセット
                    setPostCount(statsData.post_count || 0);
                    setStreakDays(statsData.streak_days || 0); 
                }
            } else {
                console.warn('Failed to fetch /user-stats', statsRes.status);
                if (mounted) {
                    setPostCount(0);
                    setStreakDays(0);
                }
            }
        } catch (statsErr) {
            console.error('Error fetching /user-stats', statsErr);
            if (mounted) {
                setPostCount(0);
                setStreakDays(0);
            }
        }
        if (mounted) {
            setLoading(false); // API呼び出し後にロード完了
        }

      } catch (err) {
        console.error(err);
        if (mounted) {
          setUsername('あなた');
          setPostCount(0);
          setStreakDays(0);
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, []); // 依存配列は空のまま

  return (
    <>
      <main className={styles.mainGrid}>
        <aside className={styles.userPanel}>
          <div className={styles.modalWrap}>
            <div className={styles.modalCard} role="region" aria-labelledby="user-card">
              {/* アバターを大きく */}
              <div className={styles.userAvatar} aria-hidden>{username ? username.charAt(0).toUpperCase() : 'U'}</div>
              {/* ユーザー名を太く */}
              <h2 className={styles.userName} id="user-card">{username}</h2>
              {/* 投稿数を表示 */}
              <p className={styles.userMeta}>投稿数: {loading ? '…' : postCount}</p>
            </div>
          </div>
        </aside>

        <section className={styles.streakColumn}>
          <div className={styles.modalWrap}>
            <div className={styles.modalCard} role="region" aria-labelledby="big-streak">
              {/* 連続日数を大きく、アクセントカラーで */}
              <div className={styles.bigNumber} id="big-streak">{loading ? '…' : streakDays}</div>
              {/* 見出しを大きく */}
              <h3 className={styles.bigHeadline}>{loading ? '読み込み中…' : `${streakDays}日連続投稿！`}</h3>
              <p className={styles.description}><strong>{username}</strong> さんの次回作も楽しみです！</p>

              <div className={styles.modalDivider} />
            </div>
          </div>
        </section>
      </main>
      {/* sub navigation under the main columns */}
      <div className={styles.subNav} role="navigation" aria-label="page links">
        <Link href="/" className={styles.navButton}>Welcome</Link>
        <Link href="/login" className={styles.navButton}>Logon/Login</Link>
        <Link href="/user-home" className={styles.navButton}>Home</Link>
        <Link href="/post" className={styles.navButton}>Post</Link>
        <Link href="/diary" className={styles.navButton}>Diary</Link>
        <Link href="/settings" className={styles.navButton}>Settings</Link>
      </div>
    </>
  );
}

export default function HomeWrapper() {
  return (
    <AuthGuard>
      <HomePage />
    </AuthGuard>
  );
}