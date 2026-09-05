export const IOC_LA28_QUALIFICATION_HUB_URL = 'https://www.olympics.com/ioc/documents/olympic-games/los-angeles-2028-olympic-games';

export const IOC_LA28_QUALIFICATION_PRINCIPLES = {
  id: 'ioc-la28-qualification-principles',
  title: 'LA28 Qualification System Principles',
  publishedAt: '2026-05-12',
  url: 'https://stillmed.olympics.com/media/Documents/Olympic-Games/LA28/LA2028-Qualification-System-Principles.pdf'
};

const BASE_URL = 'https://stillmed.olympics.com/media/Documents/Olympic-Games/LA28/';

function document(id, title, publishedAt, filename, sports = []) {
  return { id: `ioc-${id}`, title, publishedAt, url: `${BASE_URL}${filename}`, sports };
}

// These direct PDFs are listed by the IOC on the LA28 document hub. They explain
// the qualification rules and quotas, but never constitute proof that a country
// or athlete has qualified.
const bySystem = {
  '3x3-basketball': [document('3x3-basketball', '3x3 Basketball', '2026-07-10', 'BK3-LA28-Qualification-System.pdf')],
  archery: [document('archery', 'Archery', '2026-05-12', 'ARC-LA28-Qualification-System.pdf')],
  aquatics: [
    document('artistic-swimming', 'Artistic Swimming', '2026-05-12', 'SWA-LA28-Qualification-System.pdf', ['Artistic Swimming']),
    document('diving', 'Diving', '2026-06-16', 'DIV-LA28-Qualification-System.pdf', ['Diving']),
    document('open-water-swimming', 'Open Water Swimming', '2026-05-12', 'OWS-LA28-Qualification-System.pdf', ['Open Water Swimming']),
    document('swimming', 'Swimming', '2026-05-12', 'SWM-LA28-Qualification-System.pdf', ['Swimming']),
    document('water-polo', 'Water Polo', '2026-05-06', 'WPO-LA28-Qualification-System.pdf', ['Water Polo'])
  ],
  badminton: [document('badminton', 'Badminton', '2026-05-12', 'BDM-LA28-Qualification-System.pdf')],
  'baseball-softball': [document('baseball-softball', 'Baseball and Softball', '2026-05-12', 'BSB-LA28-Qualification-System.pdf')],
  basketball: [document('basketball', 'Basketball', '2026-05-12', 'BKB-LA28-Qualification-System.pdf')],
  boxing: [document('boxing', 'Boxing', '2026-08-05', 'BOX-LA28-Qualification-System.pdf')],
  climbing: [
    document('climbing-boulder', 'Climbing - Boulder', '2026-07-24', 'CLB-Boulder-LA28-Qualification-System.pdf'),
    document('climbing-lead', 'Climbing - Lead', '2026-07-24', 'CLB-Lead-LA28-Qualification-System.pdf'),
    document('climbing-speed', 'Climbing - Speed', '2026-07-24', 'CLB-Speed-LA28-Qualification-System.pdf')
  ],
  cricket: [document('cricket', 'Cricket', '2026-06-29', 'CRT-LA28-Qualification-System.pdf')],
  cycling: [
    document('cycling-road', 'Cycling Road', '2026-05-12', 'CRD-LA28-Qualification-System.pdf', ['Cycling Road (Road Race)', 'Cycling Road (Time Trial)']),
    document('cycling-track', 'Cycling Track', '2026-07-10', 'CTR-LA28-Qualification-System.pdf', ['Cycling Track']),
    document('mountain-bike', 'Mountain Bike', '2026-07-10', 'MTB-LA28-Qualification-System.pdf', ['Mountain Bike']),
    document('bmx-freestyle', 'BMX Freestyle', '2026-07-22', 'BMF-LA28-Qualification-System.pdf', ['BMX Freestyle']),
    document('bmx-racing', 'BMX Racing', '2026-07-10', 'BMX-LA28-Qualification-System.pdf', ['BMX Racing'])
  ],
  equestrian: [
    document('equestrian-dressage', 'Equestrian Dressage', '2026-06-23', 'EQU-DRS-LA28-Qualification-System.pdf'),
    document('equestrian-eventing', 'Equestrian Eventing', '2026-06-23', 'EQU-EVE-LA28-Qualification-System.pdf'),
    document('equestrian-jumping', 'Equestrian Jumping', '2026-06-23', 'EQU-JPG-LA28-Qualification-System.pdf')
  ],
  fencing: [document('fencing', 'Fencing', '2026-05-12', 'FEN-LA28-Qualification-System.pdf')],
  'flag-football': [document('flag-football', 'Flag Football', '2026-07-10', 'FFB-LA28-Qualification-System.pdf')],
  golf: [document('golf', 'Golf', '2026-08-28', 'GLF-LA28-Qualification-System.pdf')],
  gymnastics: [
    document('artistic-gymnastics', 'Artistic Gymnastics', '2026-05-29', 'GAR-LA28-Qualification-System.pdf', ['Artistic Gymnastics']),
    document('rhythmic-gymnastics', 'Rhythmic Gymnastics', '2026-05-12', 'GRY-LA28-Qualification-System.pdf', ['Rhythmic Gymnastics']),
    document('trampoline', 'Trampoline', '2026-05-12', 'GTR-LA28-Qualification-System.pdf', ['Trampoline Gymnastics'])
  ],
  handball: [document('handball', 'Handball', '2026-05-12', 'HBL-LA28-Qualification-System.pdf')],
  hockey: [document('hockey', 'Hockey', '2026-05-12', 'HOC-LA28-Qualification-System.pdf')],
  judo: [document('judo', 'Judo', '2026-05-12', 'JUD-LA28-Qualification-System.pdf')],
  lacrosse: [document('lacrosse', 'Lacrosse', '2026-05-12', 'LAC-LA28-Qualification-System.pdf')],
  'modern-pentathlon': [document('modern-pentathlon', 'Modern Pentathlon', '2026-05-12', 'MPN-LA28-Qualification-System.pdf')],
  rowing: [
    document('rowing', 'Rowing', '2026-05-12', 'ROW-LA28-Qualification-System.pdf', ['Rowing']),
    document('rowing-coastal', 'Rowing Coastal', '2026-05-12', 'RCB-LA28-Qualification-System.pdf', ['Rowing Coastal Beach Sprints'])
  ],
  'rugby-sevens': [document('rugby-sevens', 'Rugby Sevens', '2026-05-12', 'RU7-LA28-Qualification-System.pdf')],
  sailing: [document('sailing', 'Sailing', '2026-06-22', 'SAL-LA28-Qualification-System.pdf')],
  shooting: [document('shooting', 'Shooting', '2026-06-23', 'SHO-LA28-Qualification-System.pdf')],
  skateboarding: [document('skateboarding', 'Skateboarding', '2026-07-10', 'SKB-LA28-Qualification-System.pdf')],
  canoe: [
    document('slalom-paddle', 'Slalom Paddle', '2026-05-12', 'PSL-LA28-Qualification-System.pdf', ['Slalom Paddle', 'Canoe Slalom']),
    document('sprint-paddle', 'Sprint Paddle', '2026-07-28', 'PSP-LA28-Qualification-System.pdf', ['Sprint Paddle', 'Canoe Sprint'])
  ],
  squash: [document('squash', 'Squash', '2026-06-23', 'SQU-LA28-Qualification-System.pdf')],
  surfing: [document('surfing', 'Surfing', '2026-06-29', 'SRF-LA28-Qualification-System.pdf')],
  'table-tennis': [document('table-tennis', 'Table Tennis', '2026-08-14', 'TTE-LA28-Qualification-System.pdf')],
  taekwondo: [document('taekwondo', 'Taekwondo', '2026-05-12', 'TKW-LA28-Qualification-System.pdf')],
  tennis: [document('tennis', 'Tennis', '2026-05-12', 'TEN-LA28-Qualification-System.pdf')],
  triathlon: [document('triathlon', 'Triathlon', '2026-05-12', 'TRI-LA28-Qualification-System.pdf')],
  volleyball: [
    document('beach-volleyball', 'Beach Volleyball', '2026-07-10', 'VBV-LA28-Qualification-System.pdf', ['Beach Volleyball']),
    document('volleyball', 'Volleyball', '2026-05-12', 'VVO-LA28-Qualification-System.pdf', ['Volleyball'])
  ],
  weightlifting: [document('weightlifting', 'Weightlifting', '2026-05-12', 'WLF-LA28-Qualification-System.pdf')],
  wrestling: [document('wrestling', 'Wrestling', '2026-08-13', 'WRE-LA28-Qualification-System.pdf')]
};

export function getIocQualificationDocuments(systemKey) {
  return bySystem[systemKey] || [];
}

export function getAllIocQualificationDocuments(systems) {
  return systems.flatMap((system) => getIocQualificationDocuments(system.key).map((entry) => ({
    ...entry,
    qualificationSystemKey: system.key,
    governingBody: system.governingBody
  })));
}

// The IOC's document CDN rejects non-browser bot checks, so we deliberately
// retain publication metadata from the IOC hub rather than generating daily
// false source failures. A document's IOC publication date is its version key.
export function buildIocQualificationRulesIndex({ systems, checkedAt }) {
  const documents = getAllIocQualificationDocuments(systems).map((entry) => ({
    ...entry,
    listedAt: checkedAt,
    availability: 'listed_by_ioc',
    sourceVersion: `ioc-published-${entry.publishedAt}`
  }));

  return {
    hubUrl: IOC_LA28_QUALIFICATION_HUB_URL,
    principles: IOC_LA28_QUALIFICATION_PRINCIPLES,
    checkedAt,
    documents,
    expectedSystemCount: systems.length,
    publishedSystemCount: new Set(documents.map((entry) => entry.qualificationSystemKey)).size,
    listedDocumentCount: documents.length,
    waitingSystems: systems.filter((system) => !getIocQualificationDocuments(system.key).length).map((system) => system.key)
  };
}
