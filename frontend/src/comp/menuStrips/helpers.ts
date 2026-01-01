import axios from 'axios';
import { forage, setPropsToContent } from '../../../helpers';
import { notifyGlobalError } from '../../hooks/useErrorsMan';

// PREVIEW EVENT CARD -----------------------------------------------------------
// Steps: if obj is already basi, just normalize into brain and preserve any “city-wide” placeholders; otherwise fetch basi-only payload, normalize base36 timestamps, merge into the existing object, then persist to forage for fast reload.
export const previewEveCard = async ({ obj, brain }) => {
	if (!obj?.id) return;
	try {
		// PLACEHOLDER PRESERVATION -------------------------------------------
		// Steps: remember whether UI was showing “city-wide” indicator (no location/place), then restore placeholders after merge so the preview doesn’t change meaning.
		const hadCityWideIndicator = !obj.location && !obj.place;
		const prevLocation = obj.location;
		const prevPlace = obj.place;

		if (obj.state === 'basi') {
			if (brain) setPropsToContent('events', [obj], brain);
			if (hadCityWideIndicator) {
				obj.place = prevPlace ?? null;
				obj.location = prevLocation ?? null;
			}
			return;
		}

		// FETCH --------------------------------------------------------------
		// Steps: request basi-only detail so preview can expand without pulling full event detail payload.
		const { data } = await axios.post('event', { eventID: obj.id, getBasiOnly: true });
		const eventData = data?.eventData;
		if (!eventData) return;

		// NORMALIZE ----------------------------------------------------------
		// Steps: convert base36-encoded timestamps into ms numbers when needed; keep already-decimal timestamps intact.
		const parsedEventData = {
			...eventData,
			// PARSE BASE36 ONLY IF VALUE IS STRING AND NOT ALREADY DECIMAL ---------
			...(eventData.ends && { ends: typeof eventData.ends === 'string' && !/^\d{10,}$/.test(eventData.ends) ? parseInt(eventData.ends, 36) : Number(eventData.ends) }),
			...(eventData.meetWhen && { meetWhen: typeof eventData.meetWhen === 'string' && !/^\d{10,}$/.test(eventData.meetWhen) ? parseInt(eventData.meetWhen, 36) : Number(eventData.meetWhen) }),
		};

		// MERGE --------------------------------------------------------------
		// Steps: mutate obj in place so references held by UI remain valid, then restore placeholders if needed.
		Object.assign(obj, parsedEventData, { state: 'basi', sync: Date.now() });
		if (hadCityWideIndicator) {
			obj.place = prevPlace ?? null;
			obj.location = prevLocation ?? null;
		}

		// BRAIN NORMALIZATION ------------------------------------------------
		// Steps: run through setPropsToContent so shared helpers can normalize derived fields and caches consistently.
		if (brain) {
			const [normalized] = setPropsToContent('events', [obj], brain) || [];
			if (normalized) Object.assign(obj, normalized);
		}

		// PERSIST ------------------------------------------------------------
		// Steps: persist as eve so later navigations can render preview without hitting network.
		await forage({ mode: 'set', what: 'eve', val: obj, id: obj.id });
	} catch (err) {
		console.error('Error in previewEveCard:', err);
		notifyGlobalError(err, 'Nepodařilo se načíst podrobnosti události.');
	}
};
