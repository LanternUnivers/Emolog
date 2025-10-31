"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabaseClient";
// next/navigationからuseRouterをインポート
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter(); // useRouterフックを使用可能にする

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);

  function validate() {
    if (!email) return "メールアドレスを入力してください";
    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRe.test(email)) return "有効なメールアドレスを入力してください";
    if (!password) return "パスワードを入力してください";
    if (password.length < 6) return "パスワードは6文字以上で入力してください";
    if (isSignup) {
      if (!confirmPassword) return "確認用パスワードを入力してください";
      if (password !== confirmPassword) return "パスワードが一致しません";
    }
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        // サインアップ
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        // サインアップ後はメール確認などがあるため、そのままログイン画面へ
        alert('アカウントを作成しました。メール確認後ログインしてください。');
        setIsSignup(false);
        setPassword("");
        setConfirmPassword("");
        return;
      } else {
        // サインイン
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        // 保存: access token は session オブジェクトから取得
        if (data && data.session && data.session.access_token) {
          localStorage.setItem('access_token', data.session.access_token);
          // リダイレクト先を/user-homeに変更
          router.push('/user-home');
        } else {
          throw new Error('ログインに失敗しました');
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message || err.toString() || "ログイン中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{isSignup ? "新規アカウント作成" : "ログイン"}</h1>

        <label className={styles.label} htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          className={styles.input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <label className={styles.label} htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
        />

        {isSignup && (
          <>
            <label className={styles.label} htmlFor="confirm">パスワード（確認）</label>
            <input
              id="confirm"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="もう一度パスワードを入力"
            />
          </>
        )}

        {error && <div role="alert" className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            className={styles.button}
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            aria-busy={loading}
          >
            {loading ? "送信中..." : isSignup ? "アカウント作成" : "ログイン"}
          </button>

          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setIsSignup((s) => !s);
              setError("");
            }}
          >
            {isSignup ? "ログイン画面に戻る" : "新規アカウント作成"}
          </button>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.link} onClick={() => alert('仮のパスワード再発行リンク')}>パスワードを忘れた場合</button>
        </div>
      </form>
    </div>
  );
}
