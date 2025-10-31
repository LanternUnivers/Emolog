import React from 'react';
import './page.css';

export default function HomePage() {
  return (
    <div className="emolog-hero-container">

      <main className="emolog-hero-content">
        <h1 className="tagline-large">〜あなたの感情が〜</h1>
        <h1 className="tagline-large tagline-offset">～世界を笑顔に変えていく〜</h1>
        
        <p className="description">
          Emologは、AIによる感情分析とリキャップによるセルフケア・ジャーナリングアプリです。
          日々の感情を記録するだけでなく、AIが写真に対してコメントを返し
          それらがリキャップとして映像になることで、至高のエモいを体感します。
        </p>
        
        <nav className="navigation">
          <a href="/login" className="nav-link login-button">
            Logon/Login
          </a>
        </nav>
      </main>

    </div>
  );
}