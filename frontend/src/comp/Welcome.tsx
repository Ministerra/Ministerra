// WELCOME COMPONENT -----------------------------------------------------------
// First step of introduction flow. Password confirmation required for PDK derivation.
// Calls backend to verify password, register device, and get proper credentials.

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getPasswordStrengthScore } from '../../../shared/utilities.ts';
import { deriveKeyFromPassword, storePDK, getDeviceFingerprint, forage } from '../../helpers';

function Welcome({ introCredentials, superMan, brain }) {
	// CHECK IF PDK ALREADY DERIVED (user logged in directly, not via email link) ---
	const pdkAlreadyDerived = sessionStorage.getItem('introPdkDerived') === 'true',
		[password, setPassword] = useState(''),
		[passwordStrength, setPasswordStrength] = useState(0),
		[showWeakWarning, setShowWeakWarning] = useState(false),
		[pdkDerived, setPdkDerived] = useState(pdkAlreadyDerived),
		[deriving, setDeriving] = useState(false),
		[wrongPassword, setWrongPassword] = useState(false),
		[errorCountdown, setErrorCountdown] = useState(0),
		strengthTimeout = useRef(null),
		countdownTimer = useRef(null),
		{ email, userID } = introCredentials || {},
		navigate = useNavigate();

	// ERROR COUNTDOWN TIMER ---
	useEffect(() => {
		if (errorCountdown > 0) {
			countdownTimer.current = setTimeout(() => setErrorCountdown(prev => prev - 1), 1000);
		} else {
			clearTimeout(countdownTimer.current);
		}
		return () => clearTimeout(countdownTimer.current);
	}, [errorCountdown]);

	// AUTO-ADVANCE IF PDK ALREADY DERIVED ---
	useEffect(() => {
		if (pdkAlreadyDerived) {
			sessionStorage.removeItem('introPdkDerived');
			superMan('bigButton');
		}
	}, []);

	// EMAIL CHECK (only if PDK not derived - means came via email link) ---
	useEffect(() => {
		if (!pdkAlreadyDerived && !email) navigate('/');
	}, [email, pdkAlreadyDerived]);

	// DEBOUNCED PASSWORD STRENGTH CHECK ---
	useEffect(() => {
		clearTimeout(strengthTimeout.current);
		if (!password) return setPasswordStrength(0), setShowWeakWarning(false);
		const score = getPasswordStrengthScore(false, password);
		setPasswordStrength(score);
		// SHOW WARNING AFTER DEBOUNCE ---
		strengthTimeout.current = setTimeout(() => {
			setShowWeakWarning(score < 7 && password.length > 0);
		}, 1500);
		return () => clearTimeout(strengthTimeout.current);
	}, [password]);

	// CONFIRM PASSWORD AND DERIVE PDK ---
	async function handleConfirmPassword() {
		if (passwordStrength < 7 || !email) return setShowWeakWarning(true);
		setDeriving(true);
		setWrongPassword(false);

		try {
			const print = getDeviceFingerprint();

			// BACKEND CALL ---
			// Reuse standard login endpoint for PDK derivation.
			const response = await axios.post('/entrance', { mode: 'login', email, pass: password, print }, { __skipGlobalErrorBanner: true } as any);
			const { auth, authEpoch, authExpiry, deviceSalt, deviceKey, pdkSalt } = response.data;
			const [idFromAuth] = auth?.split(':') || [];
			const userIDtoUse = userID || idFromAuth;

			// PDK DERIVATION WITH PROPER SALT ---
			const pdkValue = await deriveKeyFromPassword(password, userIDtoUse + (deviceSalt || ''));
			storePDK(pdkValue);

			// STORE AUTH DATA IN FORAGE ---
			// Worker will capture PDK from sessionStorage and persist it encrypted.
			const authVal = { auth, print, pdk: pdkValue, pdkSalt, deviceKey, epoch: authEpoch };
			await forage({ mode: 'set', what: 'auth', val: authVal, id: userIDtoUse });
			sessionStorage.removeItem('authToken');

			// UPDATE BRAIN ---
			if (brain) {
				brain.authExpiry = authExpiry;
				brain.user.id = userIDtoUse;
			}

			setPdkDerived(true);
			// ADVANCE TO NEXT SECTION ---
			superMan('bigButton');
		} catch (error: any) {
			console.error('Password confirmation failed:', error);
			const errorData = error.response?.data;
			const errorCode = typeof errorData === 'string' ? errorData : errorData?.code;
			if (errorCode === 'wrongPass' || errorCode === 'wrongLogin') {
				setWrongPassword(true);
				setTimeout(() => setWrongPassword(false), 2000);
			} else {
				setErrorCountdown(20);
			}
		} finally {
			setDeriving(false);
		}
	}

	// ENTER KEY HANDLER ---
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Enter' && passwordStrength >= 7 && !deriving) handleConfirmPassword();
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [password, passwordStrength, deriving]);

	// PDK ALREADY DERIVED ---
	if (pdkDerived) {
		return (
			<welcome-comp class='block w100 marAuto mw120 padAllS textAli'>
				{/* SUCCESS STATE --- */}
				<h1 className='fs24 xBold textSha marBotS tGreen'>Heslo ověřeno</h1>
				<p className='fs12 tGrey'>Přecházíme k nastavení profilu...</p>
			</welcome-comp>
		);
	}

	return (
		<welcome-comp class='block w100 marAuto mw120 padAllS'>
			{/* PASSWORD CONFIRMATION SECTION --- */}
			<password-section class='flexCol marBotM'>
				{/* WEAK PASSWORD WARNING --- */}
				{showWeakWarning && (
					<pass-warning class='block'>
						<span className='bRed tWhite xBold fs8 padVerXxxs padHorM block boRadXxs'>Alespoň 8 znaků, velké písmeno, symbol a číslo</span>
					</pass-warning>
				)}

				{/* PASSWORD INPUT --- */}
				<input
					title='Heslo'
					type='password'
					value={password}
					maxLength={30}
					onChange={event => {
						setPassword(event.target.value);
						setWrongPassword(false), setShowWeakWarning(false);
					}}
					className='w100 hvh4 mih4 shaSubtleLong fs16 aliCen'
					placeholder='Tvé heslo k Ministerře'
					autoFocus
				/>

				{/* PASSWORD STRENGTH VISUALIZER --- */}
				{password.length > 0 &&
					(() => {
						const progress = (passwordStrength / 7) * 100;
						const baseColor = passwordStrength < 3 ? '#e53935' : passwordStrength < 5 ? '#fb8c00' : passwordStrength < 7 ? '#1e88e5' : '#43a047';
						return (
							<strength-indicators class='posRel w100 marBoS zinMaXl' style={{ height: '10px' }}>
								<div
									className='posAbs w100'
									style={{
										top: '50%',
										transform: 'translateY(-50%)',
										height: '4px',
										background: `linear-gradient(90deg, transparent 0%, ${baseColor}33 ${50 - progress / 2}%, ${baseColor} 50%, ${baseColor}33 ${
											50 + progress / 2
										}%, transparent 100%)`,
										transition: 'background 0.3s ease',
									}}
								/>
								<div
									className='posAbs w100'
									style={{
										top: '50%',
										transform: 'translateY(-50%)',
										height: '1px',
										marginTop: '-3px',
										background: `linear-gradient(90deg, transparent 10%, ${baseColor}22 ${50 - progress / 2.5}%, ${baseColor}66 50%, ${baseColor}22 ${
											50 + progress / 2.5
										}%, transparent 90%)`,
										transition: 'background 0.3s ease',
									}}
								/>
								<div
									className='posAbs w100'
									style={{
										top: '50%',
										transform: 'translateY(-50%)',
										height: '1px',
										marginTop: '3px',
										background: `linear-gradient(90deg, transparent 10%, ${baseColor}22 ${50 - progress / 2.5}%, ${baseColor}66 50%, ${baseColor}22 ${
											50 + progress / 2.5
										}%, transparent 90%)`,
										transition: 'background 0.3s ease',
									}}
								/>
							</strength-indicators>
						);
					})()}

				{/* CONFIRM BUTTON --- */}
				{passwordStrength >= 7 && (
					<button
						onClick={handleConfirmPassword}
						disabled={deriving || errorCountdown > 0}
						className={`bBlue tWhite xBold fs16 padVerXs boRadXxs  w100 mw70 marAuto bHover shadow ${wrongPassword || errorCountdown > 0 ? 'bRed' : ''}`}
						style={{ cursor: deriving ? 'wait' : 'pointer' }}>
						{wrongPassword
							? 'Nesprávné heslo...'
							: errorCountdown > 0
							? `Něco se pokazilo, opakování za ${errorCountdown}...`
							: deriving
							? 'Aktivuji zabezpečení...'
							: 'Aktivovat šifrovací klíč'}
					</button>
				)}
			</password-section>

			{/* FOOTER INFO --- */}
			<info-text class='block marTopM textAli'>
				<span className='fs8 tGrey lh1-2 block opacityM'>
					Ministerra využívá &quot;Zero-Knowledge&quot; šifrování. <br />
					Tvé heslo nikdy neopouští tvůj prohlížeč v čitelné podobě.
				</span>
			</info-text>
		</welcome-comp>
	);
}

export default Welcome;
