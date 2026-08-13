import { fetchPageAssets } from '../../ducks/hostedAssets.duck';

// ================ Thunks ================ //

export const loadData = params => dispatch => {
  const pageId = params.pageId;
  return dispatch(fetchPageAssets({ [pageId]: `content/pages/${pageId}.json` }, false));
};
