import React from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { Form, PrimaryButton, MxAddressFields } from '../../components';

import css from './MyAddressesPage.module.css';

/**
 * Buyer's saved shipping-address form (Account → Mis direcciones). Reuses the
 * shared MxAddressFields (recipient prefix, with phone) so the field set matches
 * the checkout shipping address. The granular recipient* values are composed into
 * the stored address by the page via shippingOriginFromValues.
 */
const MyAddressesForm = props => {
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
              fieldId="myAddress"
              disabled={inProgress}
              showHeading={false}
            />

            {saveError ? (
              <p className={css.error}>
                <FormattedMessage id="MyAddressesPage.saveError" />
              </p>
            ) : null}
            {ready ? (
              <p className={css.success}>
                <FormattedMessage id="MyAddressesPage.saveSuccess" />
              </p>
            ) : null}

            <PrimaryButton type="submit" inProgress={inProgress} disabled={submitDisabled}>
              <FormattedMessage id="MyAddressesPage.submit" />
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default MyAddressesForm;
