describe('Complete Registration and Passenger Flow', () => {
  it('can register a new passenger and access the dashboard', () => {
    // 1. Visit Auth Page
    cy.visit('/auth');

    // 2. We are already on the Register page by default.
    cy.contains('Register').should('exist');

    // 3. Generate a random email to avoid "email already exists" backend errors
    // Using @gmail.com because the Python backend (Pydantic EmailStr) blocks .test or .local domains!
    const randomEmail = `passenger_${Date.now()}@gmail.com`;

    // 4. Fill out the registration form (Step 0)
    cy.contains('Full Name').parent().find('input').type('Automated Passenger');
    cy.contains('Email').parent().find('input[type="email"]').type(randomEmail);
    // Password needs uppercase, lowercase, and digit
    cy.contains('Password').parent().find('input[type="password"]').type('TestPass123!');

    // 5. Click Continue
    cy.contains('button', 'Continue').click();

    // Wait for API check (email availability) and transition to Role Selection
    cy.contains('Role Selection', { timeout: 10000 }).should('exist');

    // 6. Select Passenger Role
    cy.contains('Passenger').click();

    // 7. Click Create Account
    cy.contains('button', 'Create Account').click();

    // 8. Verify Success Screen
    cy.contains('Account created!', { timeout: 10000 }).should('exist');
    cy.contains('Redirecting you to your dashboard...').should('exist');

    // 9. Verify redirection to Passenger Dashboard
    // The AuthPage has a setTimeout of 1500ms before redirecting
    cy.url({ timeout: 10000 }).should('include', '/passenger');

    // 10. Once in dashboard, verify the map is present
    cy.get('.mapboxgl-map', { timeout: 10000 }).should('exist');
  });
});
