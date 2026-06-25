import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import * as validators from '../../../util/validators';
import { MX_STATES } from '../../../config/configMxStates';

import { FieldSelect, FieldTextInput, Heading } from '../../../components';

import css from './ShippingDetails.module.css';

/**
 * Buyer-facing shipping-address form on the checkout page.
 *
 * AV: Mexico-only address layout matching the brand reference — Calle, Número
 * Exterior/Interior, Colonia, C.P./Ciudad, Estado (MX states dropdown) and
 * Teléfono. Country is dropped from the UI and hardcoded to 'MX' downstream in
 * `getShippingDetailsMaybe`. All labels/placeholders use AV-owned `ShippingDetails.mx*`
 * keys (defined in en_av.json) so hosted Console translations can't override the
 * intended copy. Field `name`s are kept aligned with the upstream shippingDetails
 * mapping where they overlap (recipientName/recipientPhoneNumber/recipientAddressLine1/
 * recipientPostal/recipientCity/recipientState) plus the new MX-specific fields.
 *
 * @component
 * @param {Object} props
 * @param {string} props.rootClassName - The root class name for the shipping details
 * @param {string} props.className - The class name for the shipping details
 * @param {intlShape} props.intl - The intl object
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {Object} props.formApi - The form API from React Final Form
 * @param {string} props.fieldId - The field ID
 */
const ShippingDetails = props => {
  const { rootClassName, className, intl, disabled, formApi, fieldId } = props;
  const classes = classNames(rootClassName || css.root, className);

  return (
    <div className={classes}>
      <Heading as="h3" rootClassName={css.heading}>
        <FormattedMessage id="ShippingDetails.mxTitle" />
      </Heading>

      <FieldTextInput
        id={`${fieldId}.recipientName`}
        name="recipientName"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="shipping name"
        label={intl.formatMessage({ id: 'ShippingDetails.mxNameLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxNamePlaceholder' })}
        validate={validators.required(intl.formatMessage({ id: 'ShippingDetails.mxNameRequired' }))}
        onUnmount={() => formApi.change('recipientName', undefined)}
      />

      <FieldTextInput
        id={`${fieldId}.recipientAddressLine1`}
        name="recipientAddressLine1"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="shipping address-line1"
        label={intl.formatMessage({ id: 'ShippingDetails.mxStreetLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxStreetPlaceholder' })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.mxStreetRequired' })
        )}
        onUnmount={() => formApi.change('recipientAddressLine1', undefined)}
      />

      <div className={css.formRow}>
        <FieldTextInput
          id={`${fieldId}.recipientExteriorNumber`}
          name="recipientExteriorNumber"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="off"
          label={intl.formatMessage({ id: 'ShippingDetails.mxExteriorLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxExteriorPlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxExteriorRequired' })
          )}
          onUnmount={() => formApi.change('recipientExteriorNumber', undefined)}
        />

        <FieldTextInput
          id={`${fieldId}.recipientInteriorNumber`}
          name="recipientInteriorNumber"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="off"
          label={intl.formatMessage({ id: 'ShippingDetails.mxInteriorLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxInteriorPlaceholder' })}
          onUnmount={() => formApi.change('recipientInteriorNumber', undefined)}
        />
      </div>

      <FieldTextInput
        id={`${fieldId}.recipientColonia`}
        name="recipientColonia"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="off"
        label={intl.formatMessage({ id: 'ShippingDetails.mxColoniaLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxColoniaPlaceholder' })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.mxColoniaRequired' })
        )}
        onUnmount={() => formApi.change('recipientColonia', undefined)}
      />

      <div className={css.formRow}>
        <FieldTextInput
          id={`${fieldId}.recipientPostalCode`}
          name="recipientPostal"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="shipping postal-code"
          label={intl.formatMessage({ id: 'ShippingDetails.mxPostalLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxPostalPlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxPostalRequired' })
          )}
          onUnmount={() => formApi.change('recipientPostal', undefined)}
        />

        <FieldTextInput
          id={`${fieldId}.recipientCity`}
          name="recipientCity"
          disabled={disabled}
          className={css.field}
          type="text"
          autoComplete="shipping address-level2"
          label={intl.formatMessage({ id: 'ShippingDetails.mxCityLabel' })}
          placeholder={intl.formatMessage({ id: 'ShippingDetails.mxCityPlaceholder' })}
          validate={validators.required(
            intl.formatMessage({ id: 'ShippingDetails.mxCityRequired' })
          )}
          onUnmount={() => formApi.change('recipientCity', undefined)}
        />
      </div>

      <FieldSelect
        id={`${fieldId}.recipientState`}
        name="recipientState"
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

      <FieldTextInput
        id={`${fieldId}.recipientPhoneNumber`}
        name="recipientPhoneNumber"
        disabled={disabled}
        className={css.fieldFullWidth}
        type="text"
        autoComplete="shipping tel"
        label={intl.formatMessage({ id: 'ShippingDetails.mxPhoneLabel' })}
        placeholder={intl.formatMessage({ id: 'ShippingDetails.mxPhonePlaceholder' })}
        validate={validators.required(
          intl.formatMessage({ id: 'ShippingDetails.mxPhoneRequired' })
        )}
        onUnmount={() => formApi.change('recipientPhoneNumber', undefined)}
      />
    </div>
  );
};

export default ShippingDetails;
