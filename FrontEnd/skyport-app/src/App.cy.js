import React from 'react'
import App from './App'
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

describe('<App />', () => {
  it('renders and displays the SKYPORT logo', () => {
    // We mount the App component exactly as it would be in the real browser
    cy.mount(<App />)
    
    // Check if the Landing Page renders the SKYPORT text
    cy.contains('SKYPORT').should('be.visible')
  })
})
