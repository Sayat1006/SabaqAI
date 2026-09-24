import { Route, Routes } from 'react-router-dom';
import { kk } from './i18n/kk';
import { Placeholder } from './pages/Placeholder';
import { paths, type ScreenKey } from './routes';

export function App() {
  return (
    <Routes>
      {(Object.keys(paths) as ScreenKey[]).map((key) => (
        <Route key={key} path={paths[key]} element={<Placeholder screen={key} />} />
      ))}
      <Route path="*" element={<p role="alert">{kk.notFound}</p>} />
    </Routes>
  );
}
