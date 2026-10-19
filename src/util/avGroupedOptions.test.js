import { resolveOptionGroups } from './avGroupedOptions';
import { listingFieldDisplayOverrides } from '../config/configListingDisplay';
import { avListingFields } from '../config/configListingAV';

const intl = { formatMessage: ({ id }) => `t:${id}` };

describe('resolveOptionGroups', () => {
  it('translates group labels and takes option labels from enumOptions', () => {
    const groups = [
      { key: 'standard', labelTranslationKey: 'Group.standard', options: ['s', 'm'] },
    ];
    const enumOptions = [{ option: 's', label: 'S' }, { option: 'm', label: 'M' }];

    expect(resolveOptionGroups(groups, enumOptions, intl)).toEqual([
      {
        key: 'standard',
        labelTranslationKey: 'Group.standard',
        label: 't:Group.standard',
        options: [{ option: 's', label: 'S' }, { option: 'm', label: 'M' }],
      },
    ]);
  });

  it('falls back to the option key when enumOptions has no label for it', () => {
    const [group] = resolveOptionGroups([{ key: 'g', options: ['zz'] }], [], intl);
    expect(group.options).toEqual([{ option: 'zz', label: 'zz' }]);
  });

  it('keeps groups and options that are already resolved', () => {
    const groups = [{ key: 'g', label: 'Ready', options: [{ option: 'x', label: 'X' }] }];
    expect(resolveOptionGroups(groups, [], intl)).toEqual(groups);
  });

  it('handles missing groups and enumOptions', () => {
    expect(resolveOptionGroups(undefined, undefined, intl)).toEqual([]);
  });

  it('labels every all_sizes option from the real listing field', () => {
    const { groups } = listingFieldDisplayOverrides.all_sizes.saveConfig;
    const allSizes = avListingFields.find(field => field.key === 'all_sizes');
    const resolved = resolveOptionGroups(groups, allSizes.enumOptions, intl);

    resolved.forEach(group => {
      expect(group.label).toBe(`t:${group.labelTranslationKey}`);
      group.options.forEach(({ option, label }) => {
        expect(typeof label).toBe('string');
        expect(label).not.toBe('');
        // Every key in the display groups must exist in the field's options.
        expect(allSizes.enumOptions.some(o => o.option === option)).toBe(true);
      });
    });
  });
});
