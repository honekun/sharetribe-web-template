import React, { useState, useEffect } from 'react';
import InstagramFeed from '../../../../components/InstagramFeed/InstagramFeed';
import css from './BlockInstagramFeed.module.css';

const BlockInstagramFeed = ({ blockId }) => {
  const [state, setState] = useState({ status: 'idle', profile: null, posts: [] });

  useEffect(() => {
    setState(s => ({ ...s, status: 'loading' }));
    fetch('/api/instagram/feed')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setState({ status: 'done', profile: data.profile, posts: data.posts });
        } else {
          setState(s => ({ ...s, status: 'error' }));
        }
      })
      .catch(() => setState(s => ({ ...s, status: 'error' })));
  }, []);

  if (state.status === 'error') return null;

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <div id={blockId} className={css.skeleton}>
        <div className={css.skeletonCard} />
        <div className={css.skeletonCard} />
      </div>
    );
  }

  return (
    <div id={blockId} className={css.root}>
      <InstagramFeed profile={state.profile} posts={state.posts} />
    </div>
  );
};

export default BlockInstagramFeed;
