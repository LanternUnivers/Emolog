'use client';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import styles from './page.module.css';
import AuthGuard from '../../lib/AuthGuard';
import { supabase } from '../../lib/supabaseClient';

function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function DiaryPage() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth()); // 0-indexed
    const [photos, setPhotos] = useState([]);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState(null); 
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0); // 0..1
    const [timelapseUrl, setTimelapseUrl] = useState(null);
    const videoPreviewRef = useRef(null);
    const [pressed, setPressed] = useState(false);

    // 月末かどうかを判定するロジック
    const isCurrentMonthDisplayed = year === today.getFullYear() && month === today.getMonth();
    const lastDayOfDisplayedMonth = new Date(year, month + 1, 0).getDate();
    const isMonthEnd = isCurrentMonthDisplayed && today.getDate() === lastDayOfDisplayedMonth;
    const timelapseBtnClass = isMonthEnd ? `${styles['timelapse-btn']} ${styles.glow}` : styles['timelapse-btn'];


    // ユーザーセッションと写真をsupabaseから取得 (useEffect)
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const { data } = await supabase.auth.getUser();
                const user = data?.user || null;
                if (!user) {
                    if (mounted) setError('認証されていません。ログインしてください。');
                    return;
                }
                const userId = user.id;

                // APIからJST基準のデータを取得
                const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const API_ENDPOINT = `${API_BASE_URL}/photos?user_id=${encodeURIComponent(userId)}`;
                const res = await fetch(API_ENDPOINT);
                
                if (!res.ok) {
                    const text = await res.text().catch(() => null);
                    console.warn('fetch /photos failed', res.status, text);
                    if (mounted) {
                        setPhotos([]);
                        setError(text || `API error: ${res.status}`);
                    }
                    return;
                }
                const dataJson = await res.json();
                if (mounted) {
                    // dataJson には { id, date(JST), url, emotion, ai_comment, user_caption } が入っている
                    setPhotos(dataJson);
                    setError(null);
                }
            } catch (err) {
                console.error(err);
                if (mounted) {
                    setPhotos([]);
                    setError(err.message || 'fetch error');
                }
            }
        })();
        return () => { mounted = false; };
    }, []); // 初期ロード時のみ実行

    // タイムラプス生成ロジック
    async function loadImage(url) {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error('image load error: ' + url));
            img.src = url;
        });
    }
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    async function generateTimelapse() {
        if (generating) return;
        setTimelapseUrl(null);
        setGenerating(true);
        setProgress(0);
        setError(null);
        try {
            // 1. ユーザーIDを取得
            const { data } = await supabase.auth.getUser();
            const user = data?.user || null;
            if (!user) {
                setError('ユーザー認証が必要です。');
                setGenerating(false);
                return;
            }
            // 2. フォームデータを作成 (年と月を送信)
            const formData = new FormData();
            formData.append('user_id', user.id);
            formData.append('year', year);
            formData.append('month', month + 1); // 💡 0-indexed -> 1-indexed に変換

            // 3. バックエンドAPIを呼び出し
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const API_ENDPOINT = `${API_BASE_URL}/generate-timelapse`;

            const res = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                // 404 (写真なし) の場合もエラーとして表示
                throw new Error(result.detail || 'タイムラプスの生成に失敗しました。');
            }

            // 4. 返ってきたURLをセット (モーダルが開く)
            setTimelapseUrl(result.url);
        } catch (err) {
            console.error(err);
            setError(err.message || 'タイムラプス作成中にエラーが発生しました。');
        } finally {
            setGenerating(false);
            setProgress(0);
        }
    }

    const grouped = useMemo(() => {
        const map = {};
        photos.forEach(p => {
            const ymd = p.date;
            map[ymd] = map[ymd] || []; 
            map[ymd].push(p);
        });
        return map;
    }, [photos]);

    const weeks = useMemo(() => {
        const first = new Date(year, month, 1);
        const startWeekday = first.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const arr = [];
        let week = new Array(startWeekday).fill(null);
        for (let d = 1; d <= daysInMonth; d++) {
            week.push(new Date(year, month, d));
            if (week.length === 7) {
                arr.push(week);
                week = [];
            }
        }
        if (week.length) {
            while (week.length < 7) week.push(null);
            arr.push(week);
        }
        return arr;
    }, [year, month]);

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };

    // --- スライドボタン用のロジック --- 
    const dailyPhotos = selected ? grouped[selected.date] : [];
    const currentIndex = selected ? dailyPhotos.findIndex(p => p.id === selected.id) : -1;
    
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex > -1 && currentIndex < dailyPhotos.length - 1;

    // stopPropagation() でモーダル全体が閉じるのを防ぐ
    const showPrev = (e) => {
        e.stopPropagation(); 
        if (hasPrev) setSelected(dailyPhotos[currentIndex - 1]);
    };
    const showNext = (e) => {
        e.stopPropagation(); 
        if (hasNext) setSelected(dailyPhotos[currentIndex + 1]);
    };

    return (
        <div className={styles['diary-root']}>
            <header className={styles['diary-header']} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={prevMonth} aria-label="前の月">◀</button>
                <h2 style={{ margin: 0 }}>{year}年 {month + 1}月</h2>
                <button onClick={nextMonth} aria-label="次の月">▶</button>

                <div style={{ marginLeft: 12 }}>
                    <button
                        onClick={generateTimelapse}
                        disabled={generating}
                        aria-label="毎日投稿して思い出を残そう！"
                        onMouseDown={() => setPressed(true)}
                        onMouseUp={() => setPressed(false)}
                        onMouseLeave={() => setPressed(false)}
                        className={timelapseBtnClass}
                        style={{ cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1 }}
                    >
                        {isMonthEnd ? '月末！リキャプチャをみて一か月を振り返ろう！' : (generating ? '作成中…' : '毎日投稿して思い出を残そう！')}
                    </button>
                </div>
            </header>

            {error && (
                <div className={styles['api-error'] || 'api-error'} style={{ color: 'crimson', padding: 8 }}>
                    サーバーから写真を取得できませんでした: {error}
                </div>
            )}

            {generating && (
                <div style={{ padding: 8, textAlign: 'center', color: 'var(--accent)' }}>
                    リキャプチャ動画を生成中です... (最大1分ほどかかる場合があります)
                </div>
            )}

            <div className={styles['calendar-wrapper']}>
                <table className={styles.calendar}>
                    <thead>
                        <tr>
                            <th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th>
                        </tr>
                    </thead>
                    <tbody>
                        {weeks.map((week, i) => (
                            <tr key={i}>
                                {week.map((day, j) => {
                                    if (!day) return <td key={j} className={styles.empty}></td>;
                                    const ymd = formatYMD(day);
                                    const dayPhotos = grouped[ymd] || [];
                                    return (
                                        <td key={j} className={styles['day-cell']}>
                                            <div className={styles['day-number']}>{day.getDate()}</div>
                                            <div className={styles.thumbs}>
                                                {dayPhotos.slice(0, 3).map(p => (
                                                    <img
                                                        key={p.id}
                                                        src={p.url}
                                                        alt={p.user_caption || ''}
                                                        className={styles.thumb}
                                                        onClick={() => setSelected(p)}
                                                    />
                                                ))}
                                            </div>
                                            {dayPhotos.length > 3 && (
                                                <div className={styles['more-count']}>+{dayPhotos.length - 3}</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selected && (
                <div className={styles.modal} onClick={() => setSelected(null)}>
                    <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
                        
                        {/* カラム1: 画像 */}
                        <div className={styles['modal-image-wrapper']}>
                            {hasPrev && (
                                <button 
                                    className={`${styles['modal-nav']} ${styles['nav-prev']}`} 
                                    onClick={showPrev}
                                    aria-label="前の写真"
                                >
                                    &lt;
                                </button>
                            )}
                            <img
                                src={selected.url}
                                alt={selected.user_caption || '投稿画像'}
                            />
                            {hasNext && (
                                <button 
                                    className={`${styles['modal-nav']} ${styles['nav-next']}`} 
                                    onClick={showNext}
                                    aria-label="次の写真"
                                >
                                    &gt;
                                </button>
                            )}
                        </div>

                        {/* カラム2: 詳細 */}
                        <div className={styles['modal-details']}>
                            <button className={styles.close} onClick={() => setSelected(null)}>✕</button>

                            <h3>あなたのコメント</h3>
                            {selected.user_caption ? (
                                <p>{selected.user_caption}</p>
                            ) : (
                                <p className={styles['no-comment']}>この投稿にコメントはありません。</p>
                            )}

                            <h3>AIの分析コメント</h3>
                            <div className={styles['ai-comment-box']}>
                                <p>
                                    <strong>{selected.emotion}</strong><br/>
                                    {selected.ai_comment && (
                                        <>
                                            {selected.ai_comment}
                                        </>
                                    )}
                                </p>
                            </div>
                            {dailyPhotos.length > 1 && (
                                <p className={styles['photo-counter']}>
                                    {currentIndex + 1} / {dailyPhotos.length}
                                </p>
                            )}                            
                        </div>

                    </div>
                </div>
            )}

            {timelapseUrl && (
                <div className={styles.modal} onClick={() => setTimelapseUrl(null)}>
                    <div className={styles['timelapse-modal-content']} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.close} onClick={() => setTimelapseUrl(null)}>✕</button>
                        
                        <h3>{year}年 {month + 1}月 のリキャプチャ</h3>
                        
                        <video                            
                            src={timelapseUrl} 
                            style={{ width: '100%', borderRadius: '8px', background: '#000' }} 
                            controls 
                            autoPlay 
                        />
                        
                        <a 
                            href={timelapseUrl} 
                            download={`timelapse-${year}-${String(month + 1).padStart(2, '0')}.mp4`} 
                            className={styles['download-button']}
                        >
                            ダウンロード (.mp4)
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DiaryPageWrapper() {
    return (
        <AuthGuard>
            <DiaryPage />
        </AuthGuard>
    );
}