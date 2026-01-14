import axios from 'axios';
import { redirect } from 'react-router-dom';
import { forage } from '../../helpers';
import { notifyGlobalError } from '../hooks/useErrorsMan';

// EDITOR PAGE LOADER -----------------------------------------------------------
// Steps: resolve eventID, hydrate event from brain/forage, fetch full basiDeta when missing (with stale-vers guards), then return event object for editor forms.
export async function editorLoader(brain, params) {
	try {
		const eventID = params.eventID?.split('!', 1)[0];
		if (!eventID) return null;

		// LOCAL EVENT HYDRATION ------------------------------------------------
		// Steps: prefer brain.events cache, fall back to forage, and keep reference in brain so editor mutations can be reflected live.
		const event = brain.events[eventID] || (brain.events[eventID] = await forage({ mode: 'get', what: 'eve', id: eventID })) || {};
		if (event?.state !== 'basiDeta') {
			// FETCH FULL DETAIL -------------------------------------------------
			// Steps: request edit-mode payload from backend; include vers guards for stale state so backend can return minimal deltas safely.
			const { state, basiVers, detaVers } = event ?? {};
			const { eventData } = (await axios.post('event', { eventID, isEdit: true, ...(event ? (state === 'stale' ? { basiVers, detaVers } : { state }) : { noMeta: true }) })).data;
			Object.assign(event, eventData || {}, { state: 'basiDeta', sync: Date.now() });
		}

		return event || null;
	} catch (error: any) {
		const errorData = error.response?.data;
		const errorCode = typeof errorData === 'string' ? errorData : errorData?.code;
		if (errorCode === 'unauthorized') {
			await forage({ mode: 'del', what: 'token' });
			return redirect('/entrance');
		}
		notifyGlobalError(error, 'Nepodařilo se načíst detail události.');
		return null;
	}
}
