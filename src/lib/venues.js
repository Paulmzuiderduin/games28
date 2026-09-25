// Add only addresses verified against venue-owned sources. Unmapped names stay unknown.
export const venues = [
  {
    id: 'la-memorial-coliseum', name: 'Los Angeles Memorial Coliseum', aliases: ['LA Memorial Coliseum'],
    address: { streetAddress: '3911 S. Figueroa Street', addressLocality: 'Los Angeles', addressRegion: 'CA', postalCode: '90037', addressCountry: 'US' },
    sourceUrl: 'https://www.lacoliseum.com/directions/', verifiedAt: '2026-09-25'
  },
  {
    id: 'honda-center', name: 'Honda Center', aliases: [],
    address: { streetAddress: '2695 East Katella Ave.', addressLocality: 'Anaheim', addressRegion: 'CA', postalCode: '92806', addressCountry: 'US' },
    sourceUrl: 'https://hondacenter.com/arena-info/contact-us/', verifiedAt: '2026-09-25'
  },
  {
    id: 'rose-bowl-stadium', name: 'Rose Bowl Stadium', aliases: ['Rose Bowl'],
    address: { streetAddress: '1001 Rose Bowl Dr', addressLocality: 'Pasadena', addressRegion: 'CA', postalCode: '91103', addressCountry: 'US' },
    sourceUrl: 'https://www.rosebowlstadium.com/contact-us', verifiedAt: '2026-09-25'
  },
  {
    id: 'galen-center', name: 'Galen Center', aliases: ['USC Galen Center'],
    address: { streetAddress: '3400 S. Figueroa Street', addressLocality: 'Los Angeles', addressRegion: 'CA', postalCode: '90089', addressCountry: 'US' },
    sourceUrl: 'https://galencenter.org/sports/2023/11/16/frequently-asked-questions-faqs.aspx', verifiedAt: '2026-09-25'
  },
  {
    id: 'sofi-stadium', name: 'SoFi Stadium', aliases: [],
    address: { streetAddress: '1001 S. Stadium Drive', addressLocality: 'Inglewood', addressRegion: 'CA', postalCode: '90301', addressCountry: 'US' },
    sourceUrl: 'https://www.sofistadium.com/connect', verifiedAt: '2026-09-25'
  }
];
export const eventOrganizer = { '@type': 'Organization', name: 'LA28', url: 'https://la28.org/en/about-la28.html' };
export function findVenue(name) {
  const normalized = String(name || '').trim().toLowerCase();
  return venues.find(venue => [venue.name, ...venue.aliases].some(alias => alias.toLowerCase() === normalized)) || null;
}
export function venueAddress(venue) {
  return venue ? Object.values(venue.address).join(', ') : '';
}
