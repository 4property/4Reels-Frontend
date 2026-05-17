/**
 * Lucide-inspired stroked icons, stroke 1.75. Import by name:
 *   <Icon name="play" size={16} />
 *
 * Adding a new icon = adding a case to the switch. No external dependency.
 */
export function Icon({ name, size = 16, className = '', style = {} }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style,
  };
  switch (name) {
    case 'home': return (<svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/></svg>);
    case 'film': return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h4M3 16.5h4M17 7.5h4M17 12h4M17 16.5h4"/></svg>);
    case 'music': return (<svg {...common}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>);
    case 'share': return (<svg {...common}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 3.9M15.4 6.6l-6.8 3.9"/></svg>);
    case 'palette': return (<svg {...common}><path d="M12 3a9 9 0 1 0 0 18c1 0 2-.4 2-1.5s-1-1-1-2 1-1.5 2-1.5h2a4 4 0 0 0 4-4 9 9 0 0 0-9-9Z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/></svg>);
    case 'zap': return (<svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>);
    case 'shield': return (<svg {...common}><path d="M12 2 4 5v7c0 5 4 8 8 10 4-2 8-5 8-10V5l-8-3Z"/></svg>);
    case 'settings': return (<svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>);
    case 'search': return (<svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>);
    case 'bell': return (<svg {...common}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>);
    case 'help': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 5 2.3c-1 .7-2.1 1.5-2.1 2.7"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>);
    case 'plus': return (<svg {...common}><path d="M12 5v14M5 12h14"/></svg>);
    case 'filter': return (<svg {...common}><path d="M3 5h18l-7 9v6l-4-2v-4Z"/></svg>);
    case 'sort': return (<svg {...common}><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/></svg>);
    case 'chevron-down': return (<svg {...common}><path d="m6 9 6 6 6-6"/></svg>);
    case 'chevron-right': return (<svg {...common}><path d="m9 6 6 6-6 6"/></svg>);
    case 'chevron-left': return (<svg {...common}><path d="m15 6-6 6 6 6"/></svg>);
    case 'arrow-up': return (<svg {...common}><path d="M12 19V5M5 12l7-7 7 7"/></svg>);
    case 'arrow-down': return (<svg {...common}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>);
    case 'arrow-right': return (<svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case 'close': return (<svg {...common}><path d="M18 6 6 18M6 6l12 12"/></svg>);
    case 'check': return (<svg {...common}><path d="M5 12.5 10 17l9-10"/></svg>);
    case 'more': return (<svg {...common}><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>);
    case 'grip': return (<svg {...common}><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg>);
    case 'play': return (<svg {...common}><path d="M7 4v16l13-8Z" fill="currentColor" stroke="none"/></svg>);
    case 'pause': return (<svg {...common}><rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none"/></svg>);
    case 'heart': return (<svg {...common}><path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11Z"/></svg>);
    case 'heart-fill': return (<svg {...common} fill="currentColor"><path d="M12 21s-8-5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-8 11-8 11Z"/></svg>);
    case 'trash': return (<svg {...common}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3"/></svg>);
    case 'upload': return (<svg {...common}><path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>);
    case 'download': return (<svg {...common}><path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>);
    case 'edit': return (<svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>);
    case 'copy': return (<svg {...common}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>);
    case 'image': return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>);
    case 'type': return (<svg {...common}><path d="M4 7V5h16v2M9 5v14M15 19H9"/></svg>);
    case 'eye': return (<svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>);
    case 'calendar': return (<svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>);
    case 'clock': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case 'sun': return (<svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>);
    case 'moon': return (<svg {...common}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>);
    case 'home-out': return (<svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/></svg>);
    case 'grid': return (<svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>);
    case 'menu': return (<svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>);
    case 'list': return (<svg {...common}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>);
    case 'building': return (<svg {...common}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01M10 21v-4h4v4"/></svg>);
    case 'tag': return (<svg {...common}><path d="M20 12 12 20l-8-8V4h8Z"/><circle cx="8" cy="8" r="1.5"/></svg>);
    case 'hashtag': return (<svg {...common}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>);
    case 'send': return (<svg {...common}><path d="m3 11 18-8-8 18-2-8-8-2Z"/></svg>);
    case 'mic': return (<svg {...common}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>);
    case 'mic-off': return (<svg {...common}><path d="M3 3 21 21"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 12V6a3 3 0 0 0-5.9-.7"/><path d="M5 11a7 7 0 0 0 10.6 6M19 11a7 7 0 0 1-.3 2M12 18v3M8 21h8"/></svg>);
    case 'stop': return (<svg {...common}><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/></svg>);
    case 'volume': return (<svg {...common}><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M16 8a5 5 0 0 1 0 8"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>);
    case 'headphones': return (<svg {...common}><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M3 14h4v6H5a2 2 0 0 1-2-2ZM21 14h-4v6h2a2 2 0 0 0 2-2Z"/></svg>);
    case 'link': return (<svg {...common}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>);
    case 'star': return (<svg {...common}><path d="m12 3 2.9 6 6.6 1-4.8 4.6 1.2 6.6L12 18l-5.9 3.2L7.3 14.6 2.5 10 9 9Z"/></svg>);
    case 'star-fill': return (<svg {...common} fill="currentColor"><path d="m12 3 2.9 6 6.6 1-4.8 4.6 1.2 6.6L12 18l-5.9 3.2L7.3 14.6 2.5 10 9 9Z"/></svg>);
    case 'trending-up': return (<svg {...common}><path d="M3 17 9 11l4 4 8-8"/><path d="M14 7h7v7"/></svg>);
    // Socials
    case 'instagram': return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.7" fill="currentColor"/></svg>);
    case 'tiktok': return (<svg {...common}><path d="M14 3v12a4 4 0 1 1-4-4"/><path d="M14 3a5 5 0 0 0 5 5"/></svg>);
    case 'youtube': return (<svg {...common}><rect x="2" y="6" width="20" height="12" rx="3"/><path d="m10 9 5 3-5 3Z" fill="currentColor"/></svg>);
    case 'facebook': return (<svg {...common}><path d="M13 22v-8h3l.5-4H13V7.5c0-1 .3-1.8 1.7-1.8H17V2.2C16.3 2.1 15.3 2 14.2 2 11.9 2 10 3.3 10 6.8V10H7v4h3v8h3Z"/></svg>);
    case 'linkedin': return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7.5v.01M12 17v-4a2 2 0 1 1 4 0v4M12 10v7"/></svg>);
    case 'google-business': return (<svg {...common}><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M4 8h16l-1 4H5Z"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M10 21v-6h4v6"/></svg>);
    case 'pinterest': return (<svg {...common}><path d="M12 3a8.8 8.8 0 0 0-3.3 16.9c-.1-.8-.2-2 .1-2.9l1.1-4.8s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.6 2.2-4.6 4.4 0 .9.3 1.8.8 2.3.1.1.1.2.1.4l-.3 1.1c0 .2-.2.3-.5.2-1.3-.6-2.1-2.4-2.1-3.9 0-3.2 2.3-6.1 6.7-6.1 3.5 0 6.2 2.5 6.2 5.8 0 3.5-2.2 6.3-5.2 6.3-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.2 2.7A8.8 8.8 0 1 0 12 3Z"/></svg>);
    case 'database': return (<svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>);
    case 'webhook': return (<svg {...common}><path d="M18 11.5a3 3 0 1 0-5-2.2M6.5 17a3 3 0 1 0 4.2-4.2M14 18a3 3 0 1 0-1.8-5.5"/><path d="m10.6 6.5 2.4 4M15 14h-4.5M9 15l-2.5 3"/></svg>);
    case 'refresh': return (<svg {...common}><path d="M4 10a8 8 0 0 1 14-4l2 2"/><path d="M20 14a8 8 0 0 1-14 4l-2-2"/><path d="M20 4v4h-4M4 20v-4h4"/></svg>);
    case 'external': return (<svg {...common}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>);
    case 'info': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/></svg>);
    case 'alert': return (<svg {...common}><path d="M10.3 3.9 2.5 17.7a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5"/><circle cx="12" cy="17.3" r="0.7" fill="currentColor"/></svg>);
    case 'key': return (<svg {...common}><circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 10-10M17 6l3 3M14 9l3 3"/></svg>);
    case 'users': return (<svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1A4 4 0 0 1 16 11"/></svg>);
    default: return <span />;
  }
}
