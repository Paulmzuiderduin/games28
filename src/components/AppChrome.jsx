import AppLink from './AppLink.jsx';
import { trackOutboundClick } from '../lib/analytics.js';

const KOFI_URL = 'https://ko-fi.com/paulzuiderduin';
const BLUESKY_URL = 'https://bsky.app/profile/games28.bsky.social';
const PRIMARY_NAV_ITEMS = [
  { href: '/', routeNames: ['home'], label: 'Home', icon: 'home' },
  { href: '/countries', routeNames: ['countries', 'country'], label: 'Countries', icon: 'flag' },
  { href: '/sports', routeNames: ['sports', 'sport'], label: 'Sports', icon: 'sports' },
  { href: '/schedule', routeNames: ['schedule', 'session'], label: 'Schedule', icon: 'calendar' },
  { href: '/changes', routeNames: ['changes'], label: 'Changes', icon: 'pulse' }
];

function NavIcon({ name }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /><path d="M9.5 20v-6h5v6" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 5h11l-2 4 2 4H5" /></>,
    sports: <><circle cx="12" cy="12" r="8" /><path d="M8.5 5a10 10 0 0 1 7 14" /><path d="M5 9.5a10 10 0 0 0 14 5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    pulse: <><path d="M3 12h4l2.5-6 5 12 2.5-6h4" /></>
  };

  return (
    <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.home}
    </svg>
  );
}

export function SiteNavigation({ routeName, mobile = false }) {
  const navClassName = mobile ? 'mobile-tabbar' : 'desktop-nav';

  return (
    <nav className={navClassName} aria-label="Primary">
      {PRIMARY_NAV_ITEMS.map((item) => {
        const isActive = item.routeNames.includes(routeName);
        const linkClassName = mobile
          ? `mobile-tab ${isActive ? 'active' : ''}`.trim()
          : `desktop-nav-link ${isActive ? 'active' : ''}`.trim();

        return (
          <AppLink
            key={item.href}
            href={item.href}
            className={linkClassName}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}

export function ThemeToggle({ theme, preference, onToggle, onFollowDevice, compact = false }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <div className={`theme-controls ${compact ? 'theme-controls--compact' : ''}`.trim()}>
      <button
        type="button"
        className="theme-toggle"
        onClick={onToggle}
        aria-label={`Switch to ${nextTheme} mode`}
        title={`Switch to ${nextTheme} mode`}
      >
        <span className="theme-toggle__icon" aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
        {!compact ? <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span> : null}
      </button>
      {!compact && preference !== 'system' ? (
        <button type="button" className="theme-follow-device" onClick={onFollowDevice}>
          Use device setting
        </button>
      ) : null}
    </div>
  );
}

function KofiLink({ className = 'text-link', children = 'Support Games28 on Ko-fi' }) {
  return (
    <a
      href={KOFI_URL}
      className={className}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackOutboundClick('kofi_click', KOFI_URL)}
    >
      {children}
    </a>
  );
}

function BlueskyLink({ className = 'text-link', children = 'Follow on Bluesky' }) {
  return (
    <a
      href={BLUESKY_URL}
      className={className}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackOutboundClick('bluesky_click', BLUESKY_URL)}
    >
      {children}
    </a>
  );
}

export function SupportCta({ onDismiss }) {
  return (
    <section className="support-cta">
      <div>
        <p className="eyebrow">Free forever</p>
        <h2>Calendar exported. If Games28 helped, Ko-fi keeps it running.</h2>
      </div>
      <div className="support-cta-actions">
        <KofiLink className="button-primary">Support on Ko-fi</KofiLink>
        <button type="button" className="text-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

export function SiteFooter({ theme, themePreference, onToggleTheme, onFollowDeviceTheme }) {
  return (
    <footer className="site-footer">
      <p>Games28 is an independent fan-made schedule tracker and is not affiliated with LA28, the IOC, or the Olympic Games.</p>
      <div className="site-footer__links">
        <AppLink href="/sources">Data & sources</AppLink>
        <AppLink href="/report">Report an update</AppLink>
        <BlueskyLink />
        <KofiLink>Support Games28</KofiLink>
        <ThemeToggle
          theme={theme}
          preference={themePreference}
          onToggle={onToggleTheme}
          onFollowDevice={onFollowDeviceTheme}
        />
      </div>
    </footer>
  );
}
