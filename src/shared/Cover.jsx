import { useState } from 'react';

/**
 * Preview surface used everywhere a reel thumbnail or a photo is shown.
 *
 * Modes (in priority order):
 *  1. `video={true}`            → autoplays the shared reel.mp4 immediately
 *                                  (use for hero previews: editor, brand, etc.)
 *  2. `video="hover"`           → shows the still poster; only loads + plays
 *                                  the video while the cursor is hovering.
 *                                  Use this in lists / grids so you don't fan
 *                                  out N video downloads on page load.
 *  3. `src` prop or known kind  → renders a still image.
 *  4. fallback                  → striped SVG placeholder tinted by kind.
 */

/** Maps "kind" ids (used across the mock) to real asset paths. */
const PHOTO_MAP = {
  'cranford-primary': '/assets/property/primary.jpg',
  'cranford-living': '/assets/property/primary.jpg',
  'cranford-garden': '/assets/property/01-exterior-garden.jpg',
  'cranford-kitchen': '/assets/property/02-kitchen.jpg',
  'cranford-bedroom': '/assets/property/03-bedroom.jpg',
  'cranford-bathroom': '/assets/property/04-bathroom.jpg',
  'cranford-exterior': '/assets/property/05-entrance.jpg',
  docklands: '/assets/property/primary.jpg',
  stoneybatter: '/assets/property/02-kitchen.jpg',
  dalkey: '/assets/property/01-exterior-garden.jpg',
  templebar: '/assets/property/05-entrance.jpg',
  phibsborough: '/assets/property/03-bedroom.jpg',
  howth: '/assets/property/01-exterior-garden.jpg',
  smithfield: '/assets/property/04-bathroom.jpg',
  malahide: '/assets/property/primary.jpg',
  ifsc: '/assets/property/02-kitchen.jpg',
  ranelagh: '/assets/property/03-bedroom.jpg',
};

const REEL_VIDEO_SRC = '/assets/property/reel.mp4';

const PLACEHOLDER_PALETTE = {
  docklands: { a: '#dde4ee', b: '#c3cfe0', t: '#4a5772' },
  stoneybatter: { a: '#ece1e7', b: '#dcc8d3', t: '#6b4f5c' },
  dalkey: { a: '#e4ebe8', b: '#c8dad3', t: '#3f6158' },
  templebar: { a: '#efe7dc', b: '#e2d3bd', t: '#6e5a3c' },
  phibsborough: { a: '#ede4e4', b: '#dcc8c8', t: '#6b4f4f' },
  howth: { a: '#dde7ec', b: '#c3d4dc', t: '#3c5a66' },
  smithfield: { a: '#e6e6ea', b: '#cfd0d8', t: '#4a4d58' },
  malahide: { a: '#ecebe1', b: '#dcd9c0', t: '#5f5a35' },
  ifsc: { a: '#e5e9ec', b: '#ccd3d9', t: '#47525b' },
  ranelagh: { a: '#e8ede4', b: '#d3dcc8', t: '#5c6b53' },
  default: { a: '#e6e8ee', b: '#d7dbe4', t: '#5a6478' },
};

export function Cover({ kind = 'default', label, ratio = '3/4', className = '', style = {}, src, video = false }) {
  const [hovering, setHovering] = useState(false);
  const poster = src || PHOTO_MAP[kind];
  const aspect = { aspectRatio: ratio, ...style };

  if (video === true || video === 'hover') {
    const isHover = video === 'hover';
    const showVideo = !isHover || hovering;

    return (
      <div
        className={`cover with-video ${className}`}
        style={aspect}
        onMouseEnter={isHover ? () => setHovering(true) : undefined}
        onMouseLeave={isHover ? () => setHovering(false) : undefined}
      >
        {showVideo ? (
          <video
            className="cover-media"
            src={REEL_VIDEO_SRC}
            poster={poster}
            autoPlay muted loop playsInline preload="auto"
          />
        ) : (
          // Use the property photo as a still preview. The browser only
          // hits the network for this single image — no video bytes are
          // requested until the user expresses intent (hover).
          <img className="cover-media" src={poster} alt={label || ''} loading="lazy" />
        )}
      </div>
    );
  }

  const resolvedSrc = src || PHOTO_MAP[kind];
  if (resolvedSrc) {
    return (
      <div className={`cover ${className}`} style={aspect}>
        <img className="cover-media" src={resolvedSrc} alt={label || ''} loading="lazy" />
      </div>
    );
  }

  const c = PLACEHOLDER_PALETTE[kind] || PLACEHOLDER_PALETTE.default;
  return (
    <div
      className={`cover ${className}`}
      style={{
        ...aspect,
        background: `repeating-linear-gradient(45deg, ${c.a} 0 10px, ${c.b} 10px 20px)`,
      }}
    >
      {label ? (
        <div className="cover-label" style={{ color: c.t }}>{label}</div>
      ) : null}
    </div>
  );
}
