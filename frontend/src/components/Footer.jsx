import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        &copy; {new Date().getFullYear()} My Emolog Website. All rights reserved.
      </p>
    </footer>
  );
}