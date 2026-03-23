'use client';

import { useEffect, useMemo, useState } from 'react';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

export default function DigitalClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours12 = useMemo(() => {
    const h = now.getHours();
    const m = h % 12;
    return m === 0 ? 12 : m;
  }, [now]);

  const formatted = useMemo(() => {
    const hours = pad2(hours12);
    const minutes = pad2(now.getMinutes());
    const seconds = pad2(now.getSeconds());
    const amPm = now.getHours() >= 12 ? 'PM' : 'AM';

    const currentDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(now);

    return { hours, minutes, seconds, amPm, currentDate };
  }, [hours12, now]);

  return (
    <div className="digital-clock">
      <div className="time-display" aria-label="Current time">
        <div className="time-segment hours">
          <span className="time-value">{formatted.hours}</span>
        </div>
        <div className="time-separator">:</div>
        <div className="time-segment minutes">
          <span className="time-value">{formatted.minutes}</span>
        </div>
        <div className="time-separator">:</div>
        <div className="time-segment seconds">
          <span className="time-value">{formatted.seconds}</span>
        </div>
        <div className="am-pm">{formatted.amPm}</div>
      </div>
      <div className="date-display">{formatted.currentDate}</div>
    </div>
  );
}

