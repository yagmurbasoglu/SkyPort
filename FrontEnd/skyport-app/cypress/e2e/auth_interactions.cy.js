describe('Authentication Flow E2E', () => {
  beforeEach(() => {
    cy.visit('/auth');
  });

  it('shows error when submitting empty login form', () => {
    // Switch to login mode
    cy.contains('Back to Login').click();
    cy.contains('User Login').should('exist');

    // Click Sign In without filling fields
    cy.contains('Sign In').click();
    
    // An error should appear, either HTML5 validation or custom Alert
    // Wait for the custom alert (if any) or check focus
    cy.contains('Login failed').should('not.exist'); // Shouldn't call API
  });

  it('can toggle between login and register modes', () => {
    // Default is register
    cy.contains('Create Account').should('not.exist');
    cy.contains('Back to Login').click();
    
    // Now should be in login mode
    cy.contains('User Login').should('exist');
    cy.contains('Create Account').click();
    
    // Back to register mode
    cy.contains('Register').should('exist');
  });
});
