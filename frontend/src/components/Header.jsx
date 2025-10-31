import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand}>
          <h1 className={styles.title}>
            Emolog
          </h1>
        </Link>

        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>Welcome</Link>
          <Link href="/login" className={styles.navLink}>Logon/Login</Link>
          <Link href="/user-home" className={styles.navLink}>UserHome</Link>
          <Link href="/post" className={styles.navLink}>Post</Link>
          <Link href="/diary" className={styles.navLink}>Diary</Link>
          <Link href="/settings" className={styles.navLink}>Settings</Link>
        </nav>
      </div>
    </header>
  );
}