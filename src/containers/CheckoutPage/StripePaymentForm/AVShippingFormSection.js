import React from 'react';
import { FormSpy } from 'react-final-form';

/**
 * AV: the live-shipping block that sits between the shipping address and the
 * billing details in StripePaymentForm.
 *
 * The FormSpy surfaces the address values on every change so the checkout page can
 * quote eShip (it debounces); `shippingSelectorSlot` is the resulting delivery-type
 * selector. Kept as its own component so StripePaymentForm only renders one element.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.shippingSelectorSlot
 * @param {Function} [props.onShippingValuesChange]
 */
const AVShippingFormSection = ({ shippingSelectorSlot, onShippingValuesChange }) => (
  <>
    {onShippingValuesChange ? (
      <FormSpy
        subscription={{ values: true }}
        onChange={({ values }) => onShippingValuesChange(values)}
      />
    ) : null}
    {shippingSelectorSlot}
  </>
);

export default AVShippingFormSection;
