describe('Passenger Flow E2E Tests', () => {
  beforeEach(() => {
    // Intercept standard API requests if needed or let them hit a mock/dev backend
    // Visit the home/landing page
    cy.visit('/');
  });

  it('successfully loads the landing page', () => {
    cy.contains('SkyPort').should('be.visible');
    // Basic sanity check that the main layout mounts
    cy.get('body').should('not.be.empty');
  });

  it('can navigate to auth page to login as passenger', () => {
    // Since /passenger is a ProtectedRoute, visiting it without a token 
    // redirects us. So let's test if we can reach the Authentication page.
    cy.visit('/auth');

    // Check if login/register form is present
    cy.contains('SKYPORT').should('exist');
    cy.get('input[type="email"]').should('exist');
    cy.get('input[type="password"]').should('exist');
  });
});
