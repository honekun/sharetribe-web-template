import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { Form, PrimaryButton, MxAddressFields } from '../../components';

import css from './ShippingOriginPage.module.css';

/**
 * Seller origin-address form (Account → Dirección de origen). Reuses the checkout
 * ShippingDetails component so the field set stays identical to the checkout
 * shipping address (Calle / Número Exterior / Número Interior / Colonia / C.P. /
 * Ciudad / Estado / Teléfono). The granular recipient* values are composed into
 * the stored `shippingOrigin` object by the page via shippingOriginFromValues.
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
          form,
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
            <MxAddressFields
              intl={intl}
              formApi={form}
              fieldId="shippingOrigin"
              disabled={inProgress}
              showHeading={false}
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
