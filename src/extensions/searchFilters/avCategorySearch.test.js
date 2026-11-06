import {
  getCategoryCardSearchParams,
  getValidCategorySearchParams,
  getCategoryFilterProps,
} from './avCategorySearch';
import { convertCategoriesToSelectTreeOptions } from '../../util/search';
import { categories, ids, searchParams } from './avCategorySearch.testData.json';

describe('getCategoryCardSearchParams', () => {
  it('combines the three leather categories using complete category paths', () => {
    expect(getCategoryCardSearchParams(ids.join(','), categories)).toEqual(searchParams);
  });

  it('resolves a single nested category instead of treating it as level 1', () => {
    expect(getCategoryCardSearchParams(ids[0], categories)).toEqual({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: 'ropa-faldas',
      pub_categoryLevel3: ids[0],
    });
  });

  it('supports top-level groups, whitespace and duplicate IDs', () => {
    expect(getCategoryCardSearchParams(' ropa, bolsas, ropa ', categories)).toEqual({
      pub_categoryLevel1: 'ropa,bolsas',
    });
  });

  it('preserves legacy single-category links without category configuration', () => {
    expect(getCategoryCardSearchParams('blazers')).toEqual({ pub_categoryLevel1: 'blazers' });
  });

  it.each([undefined, '', ' , ', 'ropa,unknown', 'ropa,ropa-faldas'])(
    'does not build a search link for an empty, unknown, or mixed-depth group: %s',
    value => {
      expect(getCategoryCardSearchParams(value, categories)).toBeNull();
    }
  );

  it('uses the configured category prefix', () => {
    expect(getCategoryCardSearchParams('ropa', categories, 'department')).toEqual({
      pub_department1: 'ropa',
    });
  });
});

describe('getValidCategorySearchParams', () => {
  it('preserves OR filters spanning different parents at each level', () => {
    expect(getValidCategorySearchParams('pub_categoryLevel', categories, 1, searchParams)).toEqual(
      searchParams
    );
  });

  it('removes unknown values and categories outside the selected parent path', () => {
    const params = {
      pub_categoryLevel1: 'ropa,unknown',
      pub_categoryLevel2: 'ropa-faldas',
      pub_categoryLevel3: `${ids[0]},${ids[1]},unknown`,
    };
    expect(getValidCategorySearchParams('pub_categoryLevel', categories, 1, params)).toEqual({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: 'ropa-faldas',
      pub_categoryLevel3: ids[0],
    });
  });

  it('does not include orphaned subcategories when a parent is missing', () => {
    expect(
      getValidCategorySearchParams('pub_categoryLevel', categories, 1, {
        pub_categoryLevel3: ids.join(','),
      })
    ).toEqual({});
  });

  it('preserves a single category path and ignores unrelated search parameters', () => {
    expect(
      getValidCategorySearchParams('pub_categoryLevel', categories, 1, {
        pub_categoryLevel1: 'ropa',
        pub_categoryLevel2: 'ropa-faldas',
        keywords: 'leather',
      })
    ).toEqual({ pub_categoryLevel1: 'ropa', pub_categoryLevel2: 'ropa-faldas' });
  });

  it('trims and deduplicates category selections', () => {
    expect(
      getValidCategorySearchParams('pub_categoryLevel', categories, 1, {
        pub_categoryLevel1: ' ropa, ropa, bolsas ',
      })
    ).toEqual({ pub_categoryLevel1: 'ropa,bolsas' });
  });
});

describe('getCategoryFilterProps', () => {
  const options = convertCategoriesToSelectTreeOptions(categories);
  const queryParamNames = Object.keys(searchParams);

  it('leaves a single category path unchanged', () => {
    const props = {
      queryParamNames,
      initialValues: { pub_categoryLevel1: 'ropa' },
      options,
      onSubmit: jest.fn(),
    };
    expect(getCategoryFilterProps(props)).toEqual({
      initialValues: props.initialValues,
      options,
      onSubmit: props.onSubmit,
    });
  });

  it('shows every selected category path as one group alongside real options', () => {
    const props = getCategoryFilterProps({
      queryParamNames,
      initialValues: searchParams,
      options,
      onSubmit: jest.fn(),
    });
    expect(props.options[0].label).toBe(
      'Ropa / Faldas / Leather, Ropa / Pantalones / Leather, Ropa / Sacos y chamarras / Chamarras de piel'
    );
    expect(props.options.slice(1)).toEqual(options);
    expect(props.initialValues).toEqual({ pub_categoryLevel1: props.options[0].option });
  });

  it('preserves the real group on Apply, while allowing replacement and clearing', () => {
    const onSubmit = jest.fn();
    const props = getCategoryFilterProps({
      queryParamNames,
      initialValues: searchParams,
      options,
      onSubmit,
    });
    props.onSubmit(props.initialValues);
    expect(onSubmit).toHaveBeenLastCalledWith(searchParams);
    props.onSubmit({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: null,
      pub_categoryLevel3: null,
    });
    expect(onSubmit).toHaveBeenLastCalledWith({
      pub_categoryLevel1: 'ropa',
      pub_categoryLevel2: null,
      pub_categoryLevel3: null,
    });
    props.onSubmit(null);
    expect(onSubmit).toHaveBeenLastCalledWith(null);
  });
});
