import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { forage, getDeviceFingerprint, deriveKeyFromPassword } from '../../helpers';

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';
const noop = () => {};
const ErrorContext = createContext({ showError: noop });
export const useErrorContext = () => useContext(ErrorContext);

export function ErrorProvider({ children }) {
	const [error, setError] = useState(null);
	const [rekeyModal, setRekeyModal] = useState<{ resolve: (v: boolean) => void } | null>(null);
	const [rekeyPass, setRekeyPass] = useState('');
	const [rekeyError, setRekeyError] = useState('');
	const [rekeyLoading, setRekeyLoading] = useState(false);
	const timeoutRef = useRef();

	const clearTimer = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current), (timeoutRef.current = null);
	}, []);

	const showError = useCallback(
		message => {
			const text = typeof message === 'string' && message.trim().length ? message.trim() : DEFAULT_FALLBACK;
			setError(text), clearTimer();
			timeoutRef.current = setTimeout(() => (setError(null), (timeoutRef.current = null)), 5000);
		},
		[clearTimer]
	);

	// REKEY MODAL TRIGGER ---
	const showRekeyModal = useCallback(() => new Promise<boolean>(resolve => setRekeyModal({ resolve })), []);

	// REKEY SUBMIT HANDLER ---
	// Steps: verify password via backend, get new pdkSalt + deviceSalt, re-derive PDK, store with new fingerprint.
	const handleRekeySubmit = useCallback(async () => {
		if (!rekeyPass.trim() || !rekeyModal) return;
		setRekeyLoading(true), setRekeyError('');
		try {
			const { data } = await axios.post('/entrance', { mode: 'rekeyDevice', pass: rekeyPass });
			const { pdkSalt, deviceSalt, userID } = data;
			if (!pdkSalt) throw new Error('noPdkSalt');
			const print = getDeviceFingerprint();
			const pdkValue = await deriveKeyFromPassword(rekeyPass, (userID || '') + (deviceSalt || ''));
			await forage({ mode: 'set', what: 'auth', val: { auth: '0:0', print, pdk: pdkValue, pdkSalt }, id: userID || '0' });
			setRekeyModal(null), setRekeyPass(''), rekeyModal.resolve(true), window.location.reload();
		} catch (e: any) {
			setRekeyError(e.response?.data?.error === 'wrongPass' ? 'Nesprávné heslo' : 'Chyba při obnovení');
		} finally {
			setRekeyLoading(false);
		}
	}, [rekeyPass, rekeyModal]);

	// REKEY LOGOUT HANDLER ---
	// Steps: delegate to global logOut function exposed by Foundation.
	const handleRekeyLogout = useCallback(async () => {
		if (rekeyModal) rekeyModal.resolve(false);
		setRekeyModal(null), setRekeyPass('');
		if (window.__logOut) await window.__logOut();
		else window.location.href = '/entrance';
	}, [rekeyModal]);

	useEffect(() => clearTimer, [clearTimer]);
	useEffect(() => {
		(window.__showGlobalError = showError), (window.__showRekeyModal = showRekeyModal);
		return () => {
			if (window.__showGlobalError === showError) delete window.__showGlobalError;
			if (window.__showRekeyModal === showRekeyModal) delete window.__showRekeyModal;
		};
	}, [showError, showRekeyModal]);

	const value = useMemo(() => ({ showError, showRekeyModal }), [showError, showRekeyModal]);

	return (
		<ErrorContext.Provider value={value}>
			{children}
			{/* ERROR BANNER --- */}
			{error && (
				<div className='global-error-banner bRed tWhite textSha xBold fs7 padVerXs padHorM boRadS shaBlue' role='alert' aria-live='assertive'>
					{error}
				</div>
			)}
			{/* REKEY MODAL --- */}
			{rekeyModal && (
				<div className='fixed inset-0 bBlackTrans686 flex items-center justify-center z-50' style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
					<div className='bWhite boRadM padM' style={{ background: '#fff', borderRadius: '1.2rem', padding: '2rem', maxWidth: '32rem', width: '90%' }}>
						{/* MODAL HEADER --- */}
						<div className='fs5 xBold marBotS'>Zařízení se změnilo</div>
						{/* MODAL DESCRIPTION --- */}
						<div className='fs7 tGrey marBotM'>Zadejte heslo pro obnovení přístupu k datům.</div>
						{/* PASSWORD INPUT --- */}
						<input type='password' value={rekeyPass} onChange={e => setRekeyPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRekeySubmit()} placeholder='Heslo' autoFocus
							className='w-full padS boRadS bor1Grey fs6' style={{ width: '100%', padding: '0.8rem', borderRadius: '0.6rem', border: '1px solid #ccc', fontSize: '1.4rem', marginBottom: '1rem' }} />
						{/* ERROR MESSAGE --- */}
						{rekeyError && <div className='tRed fs8 marBotS'>{rekeyError}</div>}
						{/* CONFIRM BUTTON --- */}
						<button onClick={handleRekeySubmit} disabled={rekeyLoading || !rekeyPass.trim()} className='w-full bBlue tWhite padS boRadS fs6 xBold'
							style={{ width: '100%', padding: '0.8rem', borderRadius: '0.6rem', background: rekeyLoading ? '#999' : '#007bff', color: '#fff', fontSize: '1.4rem', fontWeight: 700, border: 'none', cursor: rekeyLoading ? 'wait' : 'pointer', marginBottom: '0.8rem' }}>
							{rekeyLoading ? 'Obnovuji...' : 'Potvrdit'}
						</button>
						{/* LOGOUT BUTTON --- */}
						<button onClick={handleRekeyLogout} disabled={rekeyLoading} className='w-full tGrey padS boRadS fs7'
							style={{ width: '100%', padding: '0.6rem', borderRadius: '0.6rem', background: 'transparent', color: '#666', fontSize: '1.2rem', border: '1px solid #ccc', cursor: rekeyLoading ? 'wait' : 'pointer' }}>
							Odhlásit se
						</button>
					</div>
				</div>
			)}
		</ErrorContext.Provider>
	);
}

export default ErrorContext;
