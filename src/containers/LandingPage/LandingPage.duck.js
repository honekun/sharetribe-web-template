import { fetchPageAssets } from '../../ducks/hostedAssets.duck';
import { loadDataExtension } from '../../extensions/landingPage';

export const ASSET_NAME = 'landing-page';

export const loadData = (params, search, config) => dispatch => {
  const pageAsset = { landingPage: `content/pages/${ASSET_NAME}.json` };
  return dispatch(fetchPageAssets(pageAsset, true)).then(assetResp =>
    loadDataExtension({ assetResp, dispatch, params, search, config })
  );
};
