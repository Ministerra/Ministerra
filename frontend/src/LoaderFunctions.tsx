// DATA LOADERS ---
// Contains route loaders for fetching and synchronizing event, editor, and setup data.
import axios from 'axios';
import { redirect } from 'react-router-dom';
import { forage, setPropsToContent, processMetas, fetchOwnProfile, extractInteractions } from '../helpers';
import { userSetupCols } from './variables';
import { notifyGlobalError } from './hooks/useErrorsMan';

// EVENT LOADER ---
// Fetches detailed event data, attendee lists, and handles local caching/syncing.
export async function eventLoader(brain, params) {
	const eventID = params.eventID.split('!', 1)[0];
	if (!eventID) return redirect('/');

	const [now, fiveMinutes, isGuest, unstableObj] = [Date.now(), 1000 * 60 * 5, !brain.user.id, brain.user.unstableObj];

	// PAST EVENT RESOLUTION ---
	const pastEvent = await (async () => {
		if (brain.user.pastEve?.[eventID]) return brain.user.pastEve?.[eventID];
		const restored = await forage({ mode: 'get', what: 'past', id: eventID });
		return restored ? (brain.user.pastEve[eventID] = restored) : null;
	})();

	let eve = pastEvent ?? brain.events[eventID] ?? (await forage({ mode: 'get', what: 'eve', id: eventID })) ?? { id: eventID, state: 'noMeta' };
	const { state = 'noMeta', cityID, basiVers = 1, detaVers = 1, starts, ends, type, usersSync: lastUsersSync = 0, sync: lastSync = 0, pastUsers } = eve;
	const isPast = pastUsers || (ends || starts) < Date.now();

	// CACHED ATTENDEE HYDRATION ---
	const cachedUserIDs = brain.user.eveUserIDs?.[eventID];
	const needsFetch = state !== 'basiDeta' || (!isPast && now - lastSync > fiveMinutes) || (type.startsWith('a') && (isPast ? !pastUsers : !cachedUserIDs));
	if (cachedUserIDs?.length && cachedUserIDs.some(id => !brain.users[id])) {
		const restored = await forage({ mode: 'get', what: 'users', id: cachedUserIDs }),
			restoredUsers = setPropsToContent('users', restored || [], brain);
		for (const user of restoredUsers) if (user?.id) brain.users[user.id] = user;
	}

	try {
		// NETWORK FETCH LOGIC ---
		if (needsFetch) {
			const citySync = brain.citiesContSync?.[cityID],
				hasRecentCitySync = typeof citySync === 'number' && now - citySync < fiveMinutes;
			const gotUsers = type.startsWith('a') && (!isPast ? (Boolean(brain.citiesTypesInTimes?.[cityID]) && hasRecentCitySync) || now - lastUsersSync < fiveMinutes : pastUsers);
			const body = {
				eventID,
				...(state === 'stale' ? { basiVers, detaVers } : { state }),
				...(unstableObj?.gotSQL?.events.includes(eventID) || (isPast && state !== 'stale') ? { gotSQL: true } : {}),
				...(gotUsers ? { gotUsers: true } : { lastUsersSync }),
			};
			const gotSQL = Boolean(body.gotSQL),
				{ eventData, eveMeta, userIDs: fetchedUserIDs, usersSync, pastUsers: fetchedPastUsers } = (await axios.post(`event`, body))?.data || {};

			// DATA PROCESSING ---
			if (eveMeta) await processMetas({ eveMetas: { [eventID]: eveMeta }, brain });
			if (fetchedUserIDs) brain.user.eveUserIDs[eventID] = fetchedUserIDs;
			else if (fetchedPastUsers) eve.pastUsers = setPropsToContent('users', fetchedPastUsers, brain);

			const parsedEventData = {
				...(eventData || {}),
				...(eventData?.ends && { ends: typeof eventData.ends === 'string' && !/^\d{10,}$/.test(eventData.ends) ? parseInt(eventData.ends, 36) : Number(eventData.ends) }),
				...(eventData?.meetWhen && {
					meetWhen: typeof eventData.meetWhen === 'string' && !/^\d{10,}$/.test(eventData.meetWhen) ? parseInt(eventData.meetWhen, 36) : Number(eventData.meetWhen),
				}),
			};
			Object.assign(eve, parsedEventData, { ...(eveMeta && brain.events[eventID]), ...(fetchedUserIDs?.length && { usersSync: usersSync || now }), state: 'basiDeta', sync: now });

			// USER INTERACTION AND PERSISTENCE ---
			if (!isGuest) {
				if (unstableObj && !gotSQL) extractInteractions([eve], 'events', brain, true);
				eve = setPropsToContent('events', [eve], brain)[0] || eve;
				if (!pastEvent && (['sur', 'may'].includes(eve.inter) || eve.own) && (eve.ends || eve.starts) < Date.now()) {
					await forage({ mode: 'set', what: 'past', id: eventID, val: eve });
					brain.user.pastEve[eventID] = eve;
				}
				(brain.user.openEve = [...(brain.user.openEve || []).filter(id => id !== eve.id), eve.id]), await forage({ mode: 'set', what: 'user', val: brain.user });
			}
			await forage({ mode: 'set', what: 'events', id: eventID, val: eve }), (brain.events[eventID] = eve);
			if (eve.title) window.history.replaceState({}, '', `/event/${eventID}!${encodeURIComponent(eve.title).replace(/\./g, '-').replace(/%20/g, '_')}`);
		}
		return eve;
	} catch (error) {
		// ERROR HANDLING AND REDIRECTS ---
		if (error.response?.data === 'unauthorized' || error.response?.status === 401) {
			await forage({ mode: 'del', what: 'token' });
			return redirect('/entrance');
		}
		if (error.response?.status === 404 || error.response?.data === 'notFound' || error.message === 'notFound') {
			delete brain.events[eventID];
			if (brain.user.eveUserIDs) delete brain.user.eveUserIDs[eventID];
			return redirect('/');
		}
		notifyGlobalError(error, 'Nepodařilo se načíst událost.'), Promise.reject(error);
	}
}

// EDITOR LOADER ---
// Fetches event data specifically for the editor view.
export async function editorLoader(brain, params) {
	try {
		const eventID = params.eventID?.split('!', 1)[0];
		if (!eventID) return null;
		const event = brain.events[eventID] || (brain.events[eventID] = await forage({ mode: 'get', what: 'eve', id: eventID })) || {};
		if (event?.state !== 'basiDeta') {
			const { state, basiVers, detaVers } = event ?? {},
				{ eventData } = (await axios.post('event', { eventID, isEdit: true, ...(event ? (state === 'stale' ? { basiVers, detaVers } : { state }) : { noMeta: true }) })).data;
			Object.assign(event, eventData || {}, { state: 'basiDeta', sync: Date.now() });
		}
		return event || null;
	} catch (error) {
		if (error.response?.data === 'unauthorized') return await forage({ mode: 'del', what: 'token' }), redirect('/entrance');
		notifyGlobalError(error, 'Nepodařilo se načíst detail události.');
	}
}

// SETUP LOADER ---
// Prepares user profile data for the setup/settings page.
export async function setupLoader(brain) {
	try {
		if (brain.user.id && !brain.user.priv) await fetchOwnProfile(brain);
		const data = userSetupCols.reduce((obj, key) => ((obj[key] = brain.user[key]), obj), {});
		return data;
	} catch (error) {
		notifyGlobalError(error, 'Nepodařilo se načíst nastavení.'), redirect('/');
	}
}
