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
    expect(screen.getByRole('heading', { name: 'Bienvenido' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });
});
