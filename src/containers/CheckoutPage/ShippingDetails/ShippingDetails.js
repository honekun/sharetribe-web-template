import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import * as validators from '../../../util/validators';
import { MX_STATES } from '../../../config/configMxStates';

import { FieldSelect, FieldTextInput, Heading } from '../../../components';

import css from './ShippingDetails.module.css';

/**
 * Mexico-only address form used for both the checkout shipping address and the
 * checkout billing address (and the account/shipping-origin form), so the field
 * set stays identical everywhere.
 *
 * AV: layout matching the brand reference — Calle, Número Exterior/Interior,
 * Colonia, C.P./Ciudad, Estado (MX states dropdown) and (optionally) Teléfono.
 * Country is dropped from the UI and hardcoded to 'MX' downstream. Labels use
 * AV-owned `ShippingDetails.mx*` keys so hosted Console translations can't override.
 *
 * Field names are `${fieldPrefix}${Suffix}` so two instances (shipping + billing)
 * can coexist in the same Final Form without colliding: prefix `recipient`
 * (default) for shipping/origin, `billing` for the billing address.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.rootClassName]
 * @param {string} [props.className]
 * @param {intlShape} props.intl
 * @param {boolean} [props.disabled]
 * @param {Object} props.formApi - The form API from React Final Form
 * @param {string} props.fieldId
 * @param {boolean} [props.showHeading=true] - Render the "Dirección de Envío" heading
 * @param {boolean} [props.showPhone=true] - Render the Teléfono field
 * @param {'recipient'|'billing'} [props.fieldPrefix='recipient'] - Field-name prefix
 */
const ShippingDetails = props => {
  const {
    rootClassName,
    className,
    intl,
    disabled,
    formApi,
    fieldId,
    showHeading = true,
    showPhone = true,
    fieldPrefix = 'recipient',
  } = props;
  const classes = classNames(rootClassName || css.root, className);

  // `${prefix}Name`, `${prefix}AddressLine1`, … so shipping + billing don't collide.
  const fieldName = suffix => `${fieldPrefix}${suffix}`;
  // Keep autocomplete tokens in the right section so the browser doesn't cross-fill.
  const ac = token => (fieldPrefix === 'billing' ? token.replace('shipping', 'billing') : token);

  return (
    <div className={classes}>
      {showHeading ? (
        <Heading as="h3" rootClassName={css.heading}>
          <FormattedMessage id="ShippingDetails.mxTitle" />
        </Heading>
      ) : null}

      <FieldTextInput
        id={`${fieldId}.${fieldName('Name')}`}
        name={fieldName('Name')}
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete={ac('shipping name')}
        label={intl.formatMessage({ id: 'ShippingDetails.mxNameLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxNamePlaceholder' })}
        validate={validators.required(intl.formatMessage({ id: 'ShippingDetails.mxNameRequired' }))}
        onUnmount={() => formApi.change(fieldName('Name'), undefined)}
      />

      <FieldTextInput
        id={`${fieldId}.${fieldName('AddressLine1')}`}
        name={fieldName('AddressLine1')}
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete={ac('shipping address-line1')}
        label={intl.formatMessage({ id: 'ShippingDetails.mxStreetLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxStreetPlaceholder' })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.mxStreetRequired' })
        )}
        onUnmount={() => formApi.change(fieldName('AddressLine1'), undefined)}
      />

      <div className={css.formRow}>
        <FieldTextInput
          id={`${fieldId}.${fieldName('ExteriorNumber')}`}
          name={fieldName('ExteriorNumber')}
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="off"
          label={intl.formatMessage({ id: 'ShippingDetails.mxExteriorLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxExteriorPlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxExteriorRequired' })
          )}
          onUnmount={() => formApi.change(fieldName('ExteriorNumber'), undefined)}
        />

        <FieldTextInput
          id={`${fieldId}.${fieldName('InteriorNumber')}`}
          name={fieldName('InteriorNumber')}
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="off"
          label={intl.formatMessage({ id: 'ShippingDetails.mxInteriorLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxInteriorPlaceholder' })}
          onUnmount={() => formApi.change(fieldName('InteriorNumber'), undefined)}
        />
      </div>

      <FieldTextInput
        id={`${fieldId}.${fieldName('Colonia')}`}
        name={fieldName('Colonia')}
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="off"
        label={intl.formatMessage({ id: 'ShippingDetails.mxColoniaLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxColoniaPlaceholder' })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.mxColoniaRequired' })
        )}
        onUnmount={() => formApi.change(fieldName('Colonia'), undefined)}
      />

      <div className={css.formRow}>
        <FieldTextInput
          id={`${fieldId}.${fieldName('Postal')}`}
          name={fieldName('Postal')}
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete={ac('shipping postal-code')}
          label={intl.formatMessage({ id: 'ShippingDetails.mxPostalLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxPostalPlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxPostalRequired' })
          )}
          onUnmount={() => formApi.change(fieldName('Postal'), undefined)}
        />

        <FieldTextInput
          id={`${fieldId}.${fieldName('City')}`}
          name={fieldName('City')}
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete={ac('shipping address-level2')}
          label={intl.formatMessage({ id: 'ShippingDetails.mxCityLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxCityPlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxCityRequired' })
          )}
          onUnmount={() => formApi.change(fieldName('City'), undefined)}
        />
      </div>

      <FieldSelect
        id={`${fieldId}.${fieldName('State')}`}
        name={fieldName('State')}
        disabled={disabled}
        className={css.fieldFullWidth}
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

      {showPhone ? (
        <FieldTextInput
          id={`${fieldId}.${fieldName('PhoneNumber')}`}
          name={fieldName('PhoneNumber')}
          disabled={disabled}
          className={css.fieldFullWidth}
          type="text"
          autoComplete={ac('shipping tel')}
          label={intl.formatMessage({ id: 'ShippingDetails.mxPhoneLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxPhonePlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxPhoneRequired' })
          )}
          onUnmount={() => formApi.change(fieldName('PhoneNumber'), undefined)}
        />
      ) : null}
    </div>
  );
};

export default ShippingDetails;
