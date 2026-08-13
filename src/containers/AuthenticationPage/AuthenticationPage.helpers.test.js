import {
  getHandleSubmitConfirm,
  getHandleSubmitSignup,
  MARKETING_CONSENT_POLICY_VERSION,
} from './AuthenticationPage.helpers';

describe('authentication marketing consent params', () => {
  test('email signup stores explicit consent evidence in protected data', () => {
    const submitSignup = jest.fn();
    getHandleSubmitSignup({ submitSignup, userFields: [], userTypes: [] })({
      userType: 'vendedor',
      email: 'seller@example.com',
      password: 'secret-password',
      fname: 'Sofía',
      lname: 'López',
      marketingConsent: true,
    });

    expect(submitSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        protectedData: expect.objectContaining({
          marketingConsent: true,
          marketingConsentSource: 'signup_email',
          marketingConsentLocale: 'es',
          marketingConsentPolicyVersion: MARKETING_CONSENT_POLICY_VERSION,
          marketingConsentAt: expect.any(String),
        }),
      })
    );
  });

  test('unchecked signup remains explicitly opted out', () => {
    const submitSignup = jest.fn();
    getHandleSubmitSignup({ submitSignup, userFields: [], userTypes: [] })({
      userType: 'vendedor',
      email: 'seller@example.com',
      password: 'secret-password',
      fname: 'Sofía',
      lname: 'López',
    });

    expect(submitSignup.mock.calls[0][0].protectedData).toEqual({
      marketingConsent: false,
    });
  });

  test('identity-provider confirmation records its distinct source', () => {
    const submitSingupWithIdp = jest.fn();
    getHandleSubmitConfirm({
      authInfo: {
        idpToken: 'token',
        idpId: 'google',
        email: 'seller@example.com',
        firstName: 'Sofía',
        lastName: 'López',
      },
      submitSingupWithIdp,
      userFields: [],
      userTypes: [],
    })({
      userType: 'vendedor-tienda',
      email: 'seller@example.com',
      firstName: 'Sofía',
      lastName: 'López',
      marketingConsent: true,
    });

    expect(submitSingupWithIdp).toHaveBeenCalledWith(
      expect.objectContaining({
        protectedData: expect.objectContaining({
          marketingConsent: true,
          marketingConsentSource: 'signup_idp',
        }),
      })
    );
  });
});
