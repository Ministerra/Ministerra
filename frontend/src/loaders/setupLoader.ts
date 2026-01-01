import { redirect } from 'react-router-dom';
import { fetchOwnProfile } from '../../helpers';
import { userSetupCols } from '../variables';

// SETUP PAGE LOADER ------------------------------------------------------------
// Steps: ensure own profile exists when logged in (so setup starts from canonical values), then return only the setup columns so form state is minimal and predictable.
export async function setupLoader(brain) {
	try {
		if (brain?.user?.id && !brain.user.priv) await fetchOwnProfile(brain);
		const data = userSetupCols.reduce((obj, key) => ((obj[key] = brain?.user?.[key]), obj), {});
		return data;
	} catch (error) {
		console.error('setupLoader error:', error);
		return redirect('/');
	}
}
