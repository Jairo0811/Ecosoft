import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../auth/AuthContext';
import { EcoSoftThemeProvider } from '../theme/ThemeContext';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('renders an accessible institutional login form', () => {
    render(
      <EcoSoftThemeProvider>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </EcoSoftThemeProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'EcoSoft Solutions S.R.L.' }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
