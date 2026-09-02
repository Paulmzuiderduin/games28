const STATUS_VALUES = new Set(['rules_published', 'watching', 'structured_live', 'review_required', 'final_entries_live']);

function qualificationEvent(key, label, sports) {
  return { key, label, sports };
}

function system(key, label, governingBody, sports, url, options = {}) {
  return {
    key,
    label,
    governingBody,
    sports,
    sourceTier: 'if',
    sourceType: options.sourceType || 'qualification_system',
    status: options.status || 'watching',
    rulesUrl: options.rulesUrl || url,
    allocationUrl: options.allocationUrl || url,
    entryUrl: options.entryUrl || null,
    adapter: options.adapter || null,
    evidenceTerms: options.evidenceTerms || [],
    confirmationCandidates: options.confirmationCandidates || [],
    // These are qualification-level labels, never LA28 schedule rounds or sessions.
    qualificationEvents: options.qualificationEvents || [],
    sourcePublishedAt: options.sourcePublishedAt || null,
    url,
    notes: options.notes || 'Publish only explicit quota allocations, selections, or final entries.'
  };
}

export const qualificationSystems = [
  system('3x3-basketball', '3x3 Basketball', 'FIBA', ['3x3 Basketball'], 'https://fiba.basketball/3x3', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['3x3 Basketball']),
    qualificationEvent('women', "Women's tournament", ['3x3 Basketball'])
  ] }),
  system('archery', 'Archery', 'World Archery', ['Archery'], 'https://www.worldarchery.sport/', { qualificationEvents: [
    qualificationEvent('recurve', 'Recurve', ['Archery']),
    qualificationEvent('compound', 'Compound', ['Archery'])
  ] }),
  system('aquatics', 'Aquatics', 'World Aquatics', ['Artistic Swimming', 'Diving', 'Open Water Swimming', 'Swimming', 'Water Polo'], 'https://www.worldaquatics.com/news/4418041/la28-los-angeles-2028-olympic-games-qualification-system-principles-finalised-swimming-open-water-swimming', { status: 'rules_published' }),
  system('athletics', 'Athletics', 'World Athletics', ['Athletics (Marathon)', 'Athletics (Race Walk)', 'Athletics (Track & Field)'], 'https://worldathletics.org/competitions/olympic-games/the-xxxiv-olympic-games-7173263'),
  system('badminton', 'Badminton', 'Badminton World Federation', ['Badminton'], 'https://corporate.bwfbadminton.com/'),
  system('baseball-softball', 'Baseball and Softball', 'World Baseball Softball Confederation', ['Baseball', 'Softball'], 'https://www.wbsc.org/', { qualificationEvents: [
    qualificationEvent('baseball', 'Baseball tournament', ['Baseball']),
    qualificationEvent('softball', 'Softball tournament', ['Softball'])
  ] }),
  system('basketball', 'Basketball', 'FIBA', ['Basketball'], 'https://www.fiba.basketball/', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['Basketball']),
    qualificationEvent('women', "Women's tournament", ['Basketball'])
  ] }),
  system('boxing', 'Boxing', 'World Boxing', ['Boxing - Final Stages', 'Boxing - Preliminary Stages'], 'https://worldboxing.org/ioc-approves-olympic-qualification-system-for-boxing-competition-at-la28/', { status: 'rules_published' }),
  system('climbing', 'Sport Climbing', 'International Federation of Sport Climbing', ['Climbing'], 'https://www.ifsc-climbing.org/'),
  system('cricket', 'Cricket', 'International Cricket Council', ['Cricket'], 'https://www.icc-cricket.com/news/first-four-teams-confirmed-for-women-s-cricket-at-la28', {
    status: 'review_required',
    sourceType: 'team_qualification',
    adapter: 'official_confirmation_article',
    evidenceTerms: ['first four teams', 'qualified', 'LA28'],
    sourcePublishedAt: '2026-06-29',
    confirmationCandidates: [
      { noc: 'AUS', sport: 'Cricket', discipline: "Women's T20 tournament", subjectType: 'team_quota', quotaCount: 1, state: 'allocated', evidenceTerms: ['Australia', 'qualified'] },
      { noc: 'GBR', sport: 'Cricket', discipline: "Women's T20 tournament", subjectType: 'team_quota', quotaCount: 1, state: 'allocated', evidenceTerms: ['Great Britain', 'qualified'] },
      { noc: 'IND', sport: 'Cricket', discipline: "Women's T20 tournament", subjectType: 'team_quota', quotaCount: 1, state: 'allocated', evidenceTerms: ['India', 'qualified'] },
      { noc: 'RSA', sport: 'Cricket', discipline: "Women's T20 tournament", subjectType: 'team_quota', quotaCount: 1, state: 'allocated', evidenceTerms: ['South Africa', 'qualified'] }
    ],
    qualificationEvents: [
      qualificationEvent('women-t20', "Women's T20 tournament", ['Cricket']),
      qualificationEvent('men-t20', "Men's T20 tournament", ['Cricket'])
    ],
    notes: 'Official prose announcements are reviewed before they become public records.'
  }),
  system('cycling', 'Cycling', 'Union Cycliste Internationale', ['BMX Freestyle', 'BMX Racing', 'Cycling Road (Road Race)', 'Cycling Road (Time Trial)', 'Cycling Track', 'Mountain Bike'], 'https://www.uci.org/pressrelease/los-angeles-2028-olympic-games-qualification-systems-and-quotas-for-cycling/43qivaAiGWBf621RhQBvDI', { status: 'rules_published' }),
  system('equestrian', 'Equestrian', 'Fédération Equestre Internationale', ['Equestrian'], 'https://inside.fei.org/', { qualificationEvents: [
    qualificationEvent('dressage-team', 'Dressage - Team', ['Equestrian']),
    qualificationEvent('dressage-individual', 'Dressage - Individual', ['Equestrian']),
    qualificationEvent('eventing-team', 'Eventing - Team', ['Equestrian']),
    qualificationEvent('eventing-individual', 'Eventing - Individual', ['Equestrian']),
    qualificationEvent('jumping-team', 'Jumping - Team', ['Equestrian']),
    qualificationEvent('jumping-individual', 'Jumping - Individual', ['Equestrian'])
  ] }),
  system('fencing', 'Fencing', 'International Fencing Federation', ['Fencing'], 'https://fie.org/'),
  system('flag-football', 'Flag Football', 'International Federation of American Football', ['Flag Football'], 'https://ifaf.org/', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['Flag Football']),
    qualificationEvent('women', "Women's tournament", ['Flag Football'])
  ] }),
  system('football', 'Football', 'FIFA', ['Football (Soccer)'], 'https://inside.fifa.com/', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['Football (Soccer)']),
    qualificationEvent('women', "Women's tournament", ['Football (Soccer)'])
  ] }),
  system('golf', 'Golf', 'International Golf Federation', ['Golf'], 'https://www.igfgolf.org/', { qualificationEvents: [
    qualificationEvent('men-individual', "Men's individual", ['Golf']),
    qualificationEvent('women-individual', "Women's individual", ['Golf'])
  ] }),
  system('gymnastics', 'Gymnastics', 'International Gymnastics Federation', ['Artistic Gymnastics', 'Rhythmic Gymnastics', 'Trampoline Gymnastics'], 'https://www.gymnastics.sport/'),
  system('handball', 'Handball', 'International Handball Federation', ['Handball'], 'https://www.ihf.info/', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['Handball']),
    qualificationEvent('women', "Women's tournament", ['Handball'])
  ] }),
  system('hockey', 'Hockey', 'International Hockey Federation', ['Hockey'], 'https://www.fih.hockey/', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['Hockey']),
    qualificationEvent('women', "Women's tournament", ['Hockey'])
  ] }),
  system('judo', 'Judo', 'International Judo Federation', ['Judo'], 'https://www.ijf.org/ijf/documents/26', { status: 'rules_published' }),
  system('lacrosse', 'Lacrosse', 'World Lacrosse', ['Lacrosse'], 'https://worldlacrosse.sport/wp-content/uploads/2026/02/LAC-LA28-Qualification-System.pdf', { status: 'rules_published', qualificationEvents: [
    qualificationEvent('men-sixes', "Men's Sixes tournament", ['Lacrosse']),
    qualificationEvent('women-sixes', "Women's Sixes tournament", ['Lacrosse'])
  ] }),
  system('modern-pentathlon', 'Modern Pentathlon', 'Union Internationale de Pentathlon Moderne', ['Modern Pentathlon'], 'https://www.uipmworld.org/'),
  system('rowing', 'Rowing', 'World Rowing', ['Rowing', 'Rowing Coastal Beach Sprints'], 'https://worldrowing.com/2025/04/09/world-rowing-welcomes-confirmation-of-rowing-programme-and-quotas-for-la-2028-olympic-games/'),
  system('rugby-sevens', 'Rugby Sevens', 'World Rugby', ['Rugby Sevens'], 'https://www.world.rugby/', { qualificationEvents: [
    qualificationEvent('men', "Men's tournament", ['Rugby Sevens']),
    qualificationEvent('women', "Women's tournament", ['Rugby Sevens'])
  ] }),
  system('sailing', 'Sailing', 'World Sailing', ['Sailing (Dinghy, Skiff & Multihull)', 'Sailing (Windsurfing & Kite)'], 'https://www.sailing.org/'),
  system('shooting', 'Shooting', 'International Shooting Sport Federation', ['Shooting (Rifle & Pistol)', 'Shooting (Shotgun)'], 'https://www.issf-sports.org/competitions/3488', { status: 'rules_published', sourceType: 'quota_tracker', adapter: 'issf_quota_tracker' }),
  system('skateboarding', 'Skateboarding', 'World Skate', ['Skateboarding (Park)', 'Skateboarding (Street)'], 'https://www.worldskate.org/'),
  system('canoe', 'Canoe', 'International Canoe Federation', ['Slalom Paddle', 'Sprint Paddle'], 'https://www.canoeicf.com/'),
  system('squash', 'Squash', 'World Squash Federation', ['Squash'], 'https://www.worldsquash.org/'),
  system('surfing', 'Surfing', 'International Surfing Association', ['Surfing'], 'https://isasurf.org/'),
  system('table-tennis', 'Table Tennis', 'International Table Tennis Federation', ['Table Tennis'], 'https://www.ittf.com/2026/02/13/road-to-la28-mapped-out-as-qualification-system-released/', { status: 'rules_published' }),
  system('taekwondo', 'Taekwondo', 'World Taekwondo', ['Taekwondo'], 'https://www.worldtaekwondo.org/'),
  system('tennis', 'Tennis', 'International Tennis Federation', ['Tennis'], 'https://www.itftennis.com/'),
  system('triathlon', 'Triathlon', 'World Triathlon', ['Triathlon'], 'https://triathlon.org/'),
  system('volleyball', 'Volleyball', 'Fédération Internationale de Volleyball', ['Beach Volleyball', 'Volleyball'], 'https://www.fivb.com/', { qualificationEvents: [
    qualificationEvent('beach-men', "Beach Volleyball - Men's tournament", ['Beach Volleyball']),
    qualificationEvent('beach-women', "Beach Volleyball - Women's tournament", ['Beach Volleyball']),
    qualificationEvent('indoor-men', "Volleyball - Men's tournament", ['Volleyball']),
    qualificationEvent('indoor-women', "Volleyball - Women's tournament", ['Volleyball'])
  ] }),
  system('weightlifting', 'Weightlifting', 'International Weightlifting Federation', ['Weightlifting'], 'https://iwf.sport/2026/02/02/qualification-system-for-the-olympic-games-la-2028-has-been-approved/', { status: 'rules_published', sourceType: 'qualification_ranking' }),
  system('wrestling', 'Wrestling', 'United World Wrestling', ['Wrestling'], 'https://cdn.uww.org/2026-02/01_qs_la28.pdf', { status: 'rules_published' })
];

export function buildQualificationSystemIndex(scheduleEntries) {
  const sports = [...new Set(scheduleEntries.map((entry) => entry.sport).filter(Boolean))].sort();
  const bySport = new Map();
  qualificationSystems.forEach((entry) => entry.sports.forEach((sport) => bySport.set(sport, entry)));

  const missingSports = sports.filter((sport) => !bySport.has(sport));
  const systems = qualificationSystems.map((entry) => ({
    ...entry,
    coveredSports: entry.sports.filter((sport) => sports.includes(sport))
  }));

  return { systems, missingSports, bySport };
}

export function toQualificationSources(systems) {
  return systems.map((entry) => ({
    id: `if-${entry.key}`,
    qualificationSystemKey: entry.key,
    label: `${entry.governingBody} - ${entry.label}`,
    governingBody: entry.governingBody,
    sport: entry.label,
    sports: entry.sports,
    sourceTier: entry.sourceTier,
    kind: entry.sourceType,
    status: STATUS_VALUES.has(entry.status) ? entry.status : 'watching',
    rulesUrl: entry.rulesUrl,
    allocationUrl: entry.allocationUrl,
    entryUrl: entry.entryUrl,
    adapter: entry.adapter,
    evidenceTerms: entry.evidenceTerms,
    confirmationCandidates: entry.confirmationCandidates,
    qualificationEvents: entry.qualificationEvents,
    sourcePublishedAt: entry.sourcePublishedAt,
    url: entry.url,
    refreshPolicy: 'daily',
    notes: entry.notes
  }));
}
