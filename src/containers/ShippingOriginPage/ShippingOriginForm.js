import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import * as validators from '../../util/validators';
import { MX_STATES } from '../../config/configMxStates';
import { Form, FieldTextInput, FieldSelect, PrimaryButton } from '../../components';

import css from './ShippingOriginPage.module.css';

/**
 * Seller origin-address form (Account → Dirección de origen). MX-only, mirrors
 * the checkout ShippingDetails field set and reuses its `ShippingDetails.mx*`
 * translation keys. Saves to currentUser.profile.protectedData.shippingOrigin.
 */
const ShippingOriginForm = props => {
  const intl = useIntl();
  return (
    <FinalForm
      {...props}
      render={fieldRenderProps => {
        const {
          rootClassName,
          className,
          handleSubmit,
          inProgress,
          ready,
          saveError,
          invalid,
          pristine,
        } = fieldRenderProps;

        const classes = classNames(rootClassName || css.form, className);
        const submitDisabled = invalid || pristine || inProgress;

        return (
          <Form className={classes} onSubmit={handleSubmit}>
            <FieldTextInput
              id="name"
              name="name"
              type="text"
              className={css.field}
              label={intl.formatMessage({ id: 'ShippingDetails.mxNameLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingDetails.mxNamePlaceholder' })}
              validate={validators.required(
                intl.formatMessage({ id: 'ShippingDetails.mxNameRequired' })
              )}
            />

            <FieldTextInput
              id="street1"
              name="street1"
              type="text"
              className={css.field}
              label={intl.formatMessage({ id: 'ShippingDetails.mxStreetLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingDetails.mxStreetPlaceholder' })}
              validate={validators.required(
                intl.formatMessage({ id: 'ShippingDetails.mxStreetRequired' })
              )}
            />

            <FieldTextInput
              id="street2"
              name="street2"
              type="text"
              className={css.field}
              label={intl.formatMessage({ id: 'ShippingDetails.mxColoniaLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingDetails.mxColoniaPlaceholder' })}
            />

            <div className={css.formRow}>
              <FieldTextInput
                id="zip"
                name="zip"
                type="text"
                className={css.fieldHalf}
                label={intl.formatMessage({ id: 'ShippingDetails.mxPostalLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingDetails.mxPostalPlaceholder' })}
                validate={validators.required(
                  intl.formatMessage({ id: 'ShippingDetails.mxPostalRequired' })
                )}
              />
              <FieldTextInput
                id="city"
                name="city"
                type="text"
                className={css.fieldHalf}
                label={intl.formatMessage({ id: 'ShippingDetails.mxCityLabel' })}
                placeholder={intl.formatMessage({ id: 'ShippingDetails.mxCityPlaceholder' })}
                validate={validators.required(
                  intl.formatMessage({ id: 'ShippingDetails.mxCityRequired' })
                )}
              />
            </div>

            <FieldSelect
              id="state"
              name="state"
              className={css.field}
              label={intl.formatMessage({ id: 'ShippingDetails.mxStateLabel' })}
              validate={validators.required(
                intl.formatMessage({ id: 'ShippingDetails.mxStateRequired' })
              )}
            >
              <option disabled value="">
                {intl.formatMessage({ id: 'ShippingDetails.mxStatePlaceholder' })}
              </option>
              {MX_STATES.map(state => (
                <option key={state.code} value={state.name}>
                  {state.name}
                </option>
              ))}
            </FieldSelect>

            <FieldTextInput
              id="phone"
              name="phone"
              type="text"
              className={css.field}
              label={intl.formatMessage({ id: 'ShippingDetails.mxPhoneLabel' })}
              placeholder={intl.formatMessage({ id: 'ShippingDetails.mxPhonePlaceholder' })}
              validate={validators.required(
                intl.formatMessage({ id: 'ShippingDetails.mxPhoneRequired' })
              )}
            />

            {saveError ? (
              <p className={css.error}>
                <FormattedMessage id="ShippingOriginPage.saveError" />
              </p>
            ) : null}
            {ready ? (
              <p className={css.success}>
                <FormattedMessage id="ShippingOriginPage.saveSuccess" />
              </p>
            ) : null}

            <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
              <FormattedMessage id="ShippingOriginPage.submit" />
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default ShippingOriginForm;
