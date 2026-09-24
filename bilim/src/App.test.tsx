import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { kk } from './i18n/kk';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routes', () => {
  it('renders the home screen with links to every mode', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: kk.screens.home })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: kk.screens.unt })).toHaveAttribute('href', '/unt');
  });

  it('renders an inner screen with a way back home', () => {
    renderAt('/unt/test');
    expect(screen.getByRole('heading', { level: 1, name: kk.screens.test })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: kk.toHome })).toHaveAttribute('href', '/');
  });

  it('shows a not-found message for unknown paths', () => {
    renderAt('/nope');
    expect(screen.getByRole('alert')).toHaveTextContent(kk.notFound);
  });
});
