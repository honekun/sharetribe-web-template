import React, { useRef } from 'react';
import css from './InstagramFeed.module.css';

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="12" cy="19" r="1.5" />
  </svg>
);

const PostCard = ({ post, profile }) => {
  const { mediaUrl, permalink, caption, likeCount, commentsCount } = post;
  const { name, username, profilePictureUrl } = profile;
  const displayCaption = caption.length > 120 ? caption.slice(0, 117) + '...' : caption;

  return (
    <article className={css.card}>
      <div className={css.cardHeader}>
        <div className={css.profileInfo}>
          {profilePictureUrl ? (
            <img src={profilePictureUrl} alt={name} className={css.avatar} />
          ) : (
            <div className={css.avatarPlaceholder} aria-hidden="true" />
          )}
          <div className={css.profileText}>
            <span className={css.profileName}>{name}</span>
            <span className={css.profileHandle}>@{username}</span>
          </div>
        </div>
        <button className={css.moreBtn} aria-label="More options">
          <MoreIcon />
        </button>
      </div>

      <a href={permalink} target="_blank" rel="noopener noreferrer" className={css.imageLink}>
        <img src={mediaUrl} alt={caption.slice(0, 80) || `Post by @${username}`} className={css.postImage} loading="lazy" />
      </a>

      <div className={css.cardBody}>
        <p className={css.postMeta}>
          <strong>{name}</strong> <span className={css.postHandle}>@{username}</span>
        </p>
        {displayCaption ? <p className={css.caption}>{displayCaption}</p> : null}
      </div>

      <div className={css.cardFooter}>
        <div className={css.footerActions}>
          <span className={css.actionItem}>
            <HeartIcon />
            {likeCount != null ? <span>{likeCount}</span> : null}
          </span>
          <span className={css.actionItem}>
            <CommentIcon />
            {commentsCount != null ? <span>{commentsCount}</span> : null}
          </span>
        </div>
        <button className={css.bookmarkBtn} aria-label="Save post">
          <BookmarkIcon />
        </button>
      </div>
    </article>
  );
};

const InstagramFeed = ({ profile, posts }) => {
  const trackRef = useRef(null);

  const scroll = direction => {
    if (!trackRef.current) return;
    const card = trackRef.current.querySelector(`.${css.card}`);
    const amount = card ? card.offsetWidth + 16 : 300;
    trackRef.current.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  if (!posts || posts.length === 0) return null;

  return (
    <div className={css.root}>
      <button className={`${css.navBtn} ${css.navBtnPrev}`} onClick={() => scroll(-1)} aria-label="Previous posts">
        &#8249;
      </button>

      <div className={css.track} ref={trackRef}>
        {posts.map(post => (
          <PostCard key={post.id} post={post} profile={profile} />
        ))}
      </div>

      <button className={`${css.navBtn} ${css.navBtnNext}`} onClick={() => scroll(1)} aria-label="Next posts">
        &#8250;
      </button>
    </div>
  );
};

export default InstagramFeed;
