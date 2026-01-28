/** ----------------------------------------------------------------------------
 * DATE/TIME UTILITIES
 * Time frame calculations and date humanization for Czech locale.
 * --------------------------------------------------------------------------- */

// GET TIME FRAMES --------------------------------------------------------------
// Steps: compute a stable set of {start,end} windows relative to “now”, return either the whole map or a named window so callers can build SQL/API filters without duplicating date math.
export function getTimeFrames(timeFrameName) {
	// INTERNAL: DAY TIMESTAMP --------------------------------------------------
	// Steps: clone base date, shift by days, then set to start-of-day or end-of-day depending on hours so window edges are deterministic.
	const getDayTimestamp = (base, hours = 0, days = 0) => {
		const d = new Date(base);
		d.setDate(d.getDate() + days);
		d.setHours(hours, hours ? 23 : 0, hours ? 59 : 0, hours ? 999 : 0);
		return d.getTime();
	};

	// INTERNAL: WEEK/WEEKEND RANGE --------------------------------------------
	// Steps: derive start day boundary from base.getDay(), then compute end boundary; avoids locale-dependent week starts by explicit offsets.
	const getRangeTimestamps = (base, type) => {
		const day = base.getDay();
		const start = getDayTimestamp(base, 0, type === 'weekend' ? (day === 6 ? 0 : 6 - day) : day === 0 ? -6 : 1 - day);
		return { start, end: getDayTimestamp(start, 23, type === 'weekend' ? 1 : 6) };
	};

	// FRAME MAP BUILDER --------------------------------------------------------
	// Steps: compute all windows once (today/tomorrow/week/weekend/nextWeek/month/twoMonths) so downstream code can just pick a key.
	const calculateTimeFrames = now => {
		const today = getDayTimestamp(now);
		const tomorrow = getDayTimestamp(now, 0, 1);
		const weekend = getRangeTimestamps(new Date(today), 'weekend');
		const week = getRangeTimestamps(new Date(today), 'week');
		const nextWeek = getRangeTimestamps(new Date(getDayTimestamp(today, 0, 7)), 'week');
		const monthEnd = getDayTimestamp(today, 23, 30);

		const nowDate = new Date(now);
		const endOfNextMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 2, 1);
		endOfNextMonth.setDate(endOfNextMonth.getDate() - 1);
		const twoMonthsEnd = getDayTimestamp(endOfNextMonth);
		return {
			anytime: { name: 'anytime', start: 0, end: Infinity },
			recent: { name: 'recent', start: 0, end: now },
			today: { name: 'today', start: today, end: getDayTimestamp(now, 23) },
			tomorrow: { name: 'tomorrow', start: tomorrow, end: getDayTimestamp(tomorrow, 23) },
			weekend: { name: 'weekend', start: weekend.start, end: weekend.end },
			week: { name: 'week', start: week.start, end: week.end },
			nextWeek: { name: 'nextWeek', start: nextWeek.start, end: nextWeek.end },
			month: { name: 'month', start: today, end: monthEnd },
			twoMonths: { name: 'twoMonths', start: today, end: twoMonthsEnd },
		};
	};
	const timeFrames = calculateTimeFrames(Date.now());
	if (timeFrameName) return timeFrames[timeFrameName] || {};
	return timeFrames;
}

// HUMANIZE DATE/TIME (CS) ------------------------------------------------------
// Steps: normalize input to Date, derive day-diff and short time deltas, optionally return label-only or granular “time ago”, otherwise format a Czech-friendly date string (with weekday/time heuristics).
export function humanizeDateTime(inp) {
	try {
		const { date: dateStr, hideFarTime, getLabel, getGranularPast, thumbRow } = inp;
		const date = new Date(typeof dateStr === 'number' ? dateStr : parseInt(dateStr, 10) || dateStr);
		if (!date || isNaN(date.getTime())) return 'Neplatné datum';

		const time = date.toLocaleTimeString('cs', { hour: '2-digit', minute: '2-digit' });
		const currentDate = new Date();
		const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
		const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

		const isToday = startOfDate === startOfToday;
		const daysDiff = Math.round((startOfDate - startOfToday) / (1000 * 60 * 60 * 24));
		const secsDiff = Math.round((date.getTime() - currentDate.getTime()) / 1000);
		const minsDiff = Math.round(secsDiff / 60);
		const hoursDiff = Math.round(minsDiff / 60);
		const isHappening = date.getTime() < currentDate.getTime() && (inp.endsInMs ? inp.endsInMs > currentDate.getTime() : currentDate.getTime() < date.getTime() + 2 * 60 * 60 * 1000);
		const alreadyPassed = currentDate.getTime() > date.getTime() && !isHappening;

		const labels = {
			0: isHappening ? 'právě probíhá' : alreadyPassed ? 'Dnes proběhlo' : 'Dnešní',
			'-1': isHappening ? 'právě probíhá' : 'včerejší',
			1: 'zítra',
			'-7': 'minulý týden',
			7: 'v týdnu',
			'-30': 'minulý měsíc',
			'-31': 'stará',
		};
		let label = labels[daysDiff] || (daysDiff > -7 && daysDiff < 0 ? 'minulý týden' : daysDiff > 0 && daysDiff < 7 ? 'v týdnu' : daysDiff > -30 && daysDiff <= -7 ? 'minulý měsíc' : daysDiff <= -30 ? 'stará' : '');

		if (getLabel) return label;
		if (getGranularPast) {
			if (Math.abs(secsDiff) < 15) return 'Právě teď';
			if (Math.abs(minsDiff) < 60) return `${Math.abs(minsDiff)} min.`;
			if (Math.abs(hoursDiff) < 24) return `${Math.abs(hoursDiff)} hod.`;
			if (Math.abs(daysDiff) < 7) return `${Math.abs(daysDiff)} dny`;
			if (Math.abs(daysDiff) < 30) return `${Math.floor(Math.abs(daysDiff) / 7)} týdny`;
			if (Math.abs(daysDiff) < 365) return `${Math.floor(Math.abs(daysDiff) / 30)} měsíce`;
			return `${Math.floor(Math.abs(daysDiff) / 365)} roky`;
		}

		const weekDays = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
		const [day, month, year] = [date.getDate(), date.getMonth() + 1, date.getFullYear()];
		const showWeekDay = daysDiff <= 60 && daysDiff >= 3;

		let datePart = isToday ? 'Dnes' : daysDiff === 1 ? 'Zítra' : daysDiff === 2 ? 'Pozítří' : daysDiff === -1 ? 'Včera' : showWeekDay ? `${weekDays[date.getDay()].slice(0, daysDiff <= 6 ? undefined : 2)} ${daysDiff <= 6 ? '' : `${day}.${month}${year === currentDate.getFullYear() ? '' : `.${year}`}`}` : `${day}.${month}${year === currentDate.getFullYear() ? '' : `.${year}`}`;

		const dateString = `${datePart}${hideFarTime && daysDiff > 90 ? '' : ` v ${time}`}`;
		if (thumbRow === 'upper') return daysDiff <= 7 ? weekDays[date.getDay()].slice(0, 2) : year === currentDate.getFullYear() ? (showWeekDay ? datePart.split(' ')[1] : datePart) : `${day}.${month}`;
		if (thumbRow === 'bottom') return daysDiff <= 7 ? time : year === currentDate.getFullYear() ? `${daysDiff <= 60 ? `${weekDays[date.getDay()].slice(0, 2)} ${time}` : weekDays[date.getDay()]}` : year.toString();

		return dateString;
	} catch (err) {
		throw new Error(err);
	}
}

// INFLECT NAME (CZECH DATIVE CASE) --------------------------------------------
// Steps: pick suffix rule by last two chars first (more specific), then last char, otherwise fall back to “em” so chat/toast strings read naturally.
export function inflectName(name) {
	const endings = {
		a: 'ou',
		e: 'em',
		i: 'ím',
		o: 'em',
		u: 'em',
		y: 'ým',
		á: 'ou',
		é: 'ým',
		í: 'ím',
		ě: 'em',
		ů: 'em',
		ř: 'řem',
		š: 'šem',
		ž: 'žem',
		c: 'cem',
		k: 'kem',
		g: 'gem',
		h: 'hem',
		ch: 'chem',
		j: 'jem',
		l: 'lem',
		m: 'mem',
		n: 'nem',
		p: 'pem',
		r: 'rem',
		s: 'sem',
		t: 'tem',
		v: 'vem',
		z: 'zem',
	};
	const lastChar = name.slice(-1),
		lastTwoChars = name.slice(-2);
	if (endings[lastTwoChars]) return name.slice(0, -2) + endings[lastTwoChars];
	else if (endings[lastChar]) return name.slice(0, -1) + endings[lastChar];
	else return name + 'em';
}
