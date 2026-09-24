import { Link } from 'react-router-dom';
import { kk } from '../i18n/kk';
import { paths, type ScreenKey } from '../routes';
import styles from './Placeholder.module.css';

type Props = { screen: ScreenKey };

// 1-кезеңдегі уақытша экран: маршруттар жұмыс істейтінін көрсетеді.
export function Placeholder({ screen }: Props) {
  const isHome = screen === 'home';
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{kk.screens[screen]}</h1>
      <p className={styles.note}>{kk.comingSoon}</p>
      {isHome ? (
        <nav aria-label={kk.appName}>
          <ul className={styles.list}>
            {(Object.keys(paths) as ScreenKey[])
              .filter((key) => key !== 'home')
              .map((key) => (
                <li key={key}>
                  <Link className={styles.link} to={paths[key]}>
                    {kk.screens[key]}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      ) : (
        <Link className={styles.link} to={paths.home}>
          {kk.toHome}
        </Link>
      )}
    </main>
  );
}
