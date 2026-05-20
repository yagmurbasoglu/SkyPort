describe('Expert / Analyst Registration Flow', () => {
  it('can register a new analyst and access the expert dashboard', () => {
    // 1. Visit Auth Page
    cy.visit('/auth');

    // 2. We are already on the Register page by default.
    cy.contains('Register').should('exist');

    // 3. Generate a random email to avoid "email already exists" backend errors
    const randomEmail = `analyst_${Date.now()}@gmail.com`;

    // 4. Fill out the registration form
    cy.contains('Full Name').parent().find('input').type('Automated Analyst');
    cy.contains('Email').parent().find('input[type="email"]').type(randomEmail);
    cy.contains('Password').parent().find('input[type="password"]').type('ExpertPass123!');

    // 5. Click Continue
    cy.contains('button', 'Continue').click();

    // Wait for API check (email availability) and transition to Role Selection
    cy.contains('Role Selection', { timeout: 10000 }).should('exist');

    // 6. Select Analyst Role
    cy.contains('Analyst').click();

    // 7. Click Create Account
    cy.contains('button', 'Create Account').click();

    // 8. Verify Success Screen
    cy.contains('Account created!', { timeout: 10000 }).should('exist');
    cy.contains('Redirecting you to your dashboard...').should('exist');

    // 9. Verify redirection to Expert Dashboard
    // The AuthPage has a setTimeout of 1500ms before redirecting
    cy.url({ timeout: 10000 }).should('include', '/expert');

    // 10. Once in dashboard, verify the map is present
    cy.get('.mapboxgl-map', { timeout: 10000 }).should('exist');
  });
});
