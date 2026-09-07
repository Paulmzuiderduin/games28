import { sportIconNames } from '../lib/sport-icons.js';

const assets = import.meta.glob('../assets/sports/*.svg', { eager: true, query: '?url', import: 'default' });

export default function SportIcon({ sport, size = 24 }) {
  const url = assets[`../assets/sports/${sportIconNames[sport]}.svg`];
  if (!url) return null;
  return <span className="sport-icon" aria-hidden="true" style={{ '--sport-icon-url': `url("${url}")`, '--sport-icon-size': `${size}px` }} />;
}
