import React from 'react';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles['emolog-hero-container']}>

      <main className={styles['emolog-hero-content']}>
        <h1 className={styles['tagline-large']}>〜あなたの感情が〜</h1>
        <h1 className={`${styles['tagline-large']} ${styles['tagline-offset']}`}>～世界を笑顔に変えていく〜</h1>

        <p className={styles['description']}>
          Emologは、AIによる感情分析とリキャップによるセルフケア・ジャーナリングアプリです。
          日々の感情を記録するだけでなく、AIが写真に対してコメントを返し
          それらがリキャップとして映像になることで、至高のエモいを体感します。
        </p>

        <nav className={styles['navigation']}>
          <a href="/login" className={`${styles['nav-link']} ${styles['login-button']}`}>
            Logon/Login
          </a>
        </nav>
      </main>

    </div>
  );
}