"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 💡 このページは「パスワード回復」セッション中かチェック
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  useEffect(() => {
    // ページロード時にURLハッシュにトークンがあるか（メールから来たか）を
    // onAuthStateChange で確認します
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoverySession(true); // パスワード更新が可能な状態
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setLoading(true);
    try {
      // 💡 ユーザーのパスワードを更新
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;
      
      alert('パスワードが正常に更新されました。ログインページに移動します。');
      router.push('/login'); // ログインページにリダイレクト

    } catch (err) {
      console.error(err);
      setError(err.message || "パスワードの更新に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  // メール経由で来ていないユーザーには何も表示しない
  if (!isRecoverySession) {
      return (
          <div className={styles.wrapper}>
            <div className={styles.card}>
                <h1 className={styles.title}>無効なリンク</h1>
                <p>このページはパスワードリセットメールからのみアクセスできます。</p>
            </div>
          </div>
      );
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>新しいパスワード</h1>

        <label className={styles.label} htmlFor="password">新しいパスワード</label>
        <input
          id="password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6文字以上"
        />

        <label className={styles.label} htmlFor="confirm">新しいパスワード（確認）</label>
        <input
          id="confirm"
          type="password"
          className={styles.input}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="もう一度入力"
        />

        {error && <div role="alert" className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            className={styles.button}
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "更新中..." : "パスワードを更新"}
          </button>
        </div>
      </form>
    </div>
  );
}