import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// A simple isolated component test to demonstrate Jest + RTL
// without triggering the React Router v7 ESM resolution bug in Jest.
const StatusBadge = ({ status }) => (
  <div data-testid="status-badge">
    {status === 'active' ? 'System Active' : 'System Offline'}
  </div>
);

describe('UI Component Tests', () => {
  it('renders the active status correctly', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('System Active');
  });

  it('renders the offline status correctly', () => {
    render(<StatusBadge status="offline" />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('System Offline');
  });
});
