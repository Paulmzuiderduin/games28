import { useEffect, useState } from 'react';
import { formatCountdown, formatDateTimeLabel } from '../lib/format.js';

export default function CountdownCard({ targetIso }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const countdown = formatCountdown(targetIso, now);

  return (
    <div className="countdown-card">
      <p className="eyebrow">Countdown</p>
      <h2>{countdown.label}</h2>
      <p>Until the Opening Ceremony on {formatDateTimeLabel(targetIso, { timeZone: 'America/Los_Angeles' })} LA time.</p>
    </div>
  );
}
