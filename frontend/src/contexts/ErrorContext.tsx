import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';

const noop = () => {};

const ErrorContext = createContext({ showError: noop });

export const useErrorContext = () => useContext(ErrorContext);

export function ErrorProvider({ children }) {
	const [error, setError] = useState(null);
	const timeoutRef = useRef();

	const clearTimer = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	const showError = useCallback(
		message => {
			const text = typeof message === 'string' && message.trim().length ? message.trim() : DEFAULT_FALLBACK;
			setError(text);
			clearTimer();
			timeoutRef.current = setTimeout(() => {
				setError(null);
				timeoutRef.current = null;
			}, 5000);
		},
		[clearTimer]
	);

	useEffect(() => clearTimer, [clearTimer]);

	const value = useMemo(() => ({ showError }), [showError]);

	useEffect(() => {
		window.__showGlobalError = showError;
		return () => {
			if (window.__showGlobalError === showError) delete window.__showGlobalError;
		};
	}, [showError]);

	return (
		<ErrorContext.Provider value={value}>
			{children}
			{error && (
				<div className='global-error-banner bRed tWhite textSha xBold fs7 padVerXs padHorM boRadS shaBlue' role='alert' aria-live='assertive'>
					{error}
				</div>
			)}
		</ErrorContext.Provider>
	);
}

export default ErrorContext;
