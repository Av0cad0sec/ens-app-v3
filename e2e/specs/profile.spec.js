import { acceptMetamaskAccess } from '../setup'

describe('Profile', () => {
  before(() => {
    cy.request(
      'POST',
      'http://localhost:8000/subgraphs/name/graphprotocol/ens',
      {
        query:
          '\n query getRecords($name: String!) {\n domains(where: { name: $name }) {\n isMigrated\n createdAt\n resolver {\n texts\n coinTypes\n contentHash\n addr {\n id\n }\n }\n }\n }\n ',
        variables: {
          name: 'jefflau.eth',
        },
        operationName: 'getRecords',
      },
    ).then((response) => {
      console.log('response; ', response)
    })
  })

  it('should allow user to connect', () => {
    acceptMetamaskAccess()
    // replace with data-testid when design system supports it
    cy.contains('0x', {
      timeout: 15000,
    }).click()
    cy.contains('Profile').should('be.visible')
    cy.contains('0x').click()
    cy.contains('Profile').should('not.be.visible')
  })

  describe('profile', () => {
    it('should go to the profile page', () => {
      cy.visit('/')
      cy.contains('Connect').click()
      cy.contains('MetaMask').click()

      cy.get('[placeholder="Search for a name"]').type('jefflau')
      cy.get('[data-testid="search-button"]', {
        timeout: 100000,
      }).click()
    })

    it(
      'should show the address records',
      {
        retries: {
          runMode: 5,
          openMode: 5,
        },
      },
      () => {
        cy.visit('/profile/jefflau.eth')
        cy.contains('Addresses').should('be.visible')
        cy.get('[data-testid="address-profile-button-eth"]', {
          timeout: 25000,
        }).should('has.text', '0x866...95eEE')
      },
    )
    it('should show profile data', () => {
      cy.contains('Hello2').should('be.visible')
      cy.contains('twitter.com').should('be.visible')
    })
  })
  describe('name details', () => {
    it('should go to the profile page', () => {
      cy.visit('/')
      cy.contains('Connect').click()
      cy.contains('MetaMask').click()

      cy.get('[placeholder="Search for a name"]').type('jefflau')
      cy.get('[data-testid="search-button"]', {
        timeout: 100000,
      }).click()
    })

    it('should show the details button on the profile page, and correctly link to the details page', () => {
      cy.contains('View Details').click()
      cy.url().should(
        'contain',
        'http://localhost:3000/profile/jefflau.eth/details',
      )
    })

    it('should show the text records', () => {
      cy.contains('Text').should('be.visible')
      cy.contains('Hello2').should('be.visible')
    })
    it('should show the address records', () => {
      cy.contains('ETH').should('be.visible')
      cy.contains('0x866B3c4994e1416B7C738B9818b31dC246b95eEE').should(
        'be.visible',
      )
    })
    it('should have correct controller/registrant data', () => {
      cy.findByTestId('controller-data').should('contain.text', 'jefflau.eth')
      cy.findByTestId('registrant-data').should('contain.text', 'jefflau.eth')
    })
    it('should show the expiry date of the name', () => {
      cy.findByTestId('expiry-data').should('contain.text', 'April 25, 2023')
    })
    it('should show profile data', () => {
      cy.contains('Hello2').should('be.visible')
      cy.contains('twitter.com').should('be.visible')
    })
  })
})