// ERROR ICON ASSET ---
// SVG representation of a warning/error indicator
const ErrorIcon = () => (
	<svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
		<circle cx="60" cy="60" r="55" stroke="#e74c3c" strokeWidth="4" fill="none" opacity="0.2"/>
		<circle cx="60" cy="60" r="45" stroke="#e74c3c" strokeWidth="3" fill="none" opacity="0.4"/>
		<circle cx="60" cy="60" r="35" fill="#e74c3c" opacity="0.15"/>
		<path d="M60 30 L60 70" stroke="#e74c3c" strokeWidth="6" strokeLinecap="round"/>
		<circle cx="60" cy="85" r="5" fill="#e74c3c"/>
	</svg>
);

// ERROR PAGE COMPONENT ---
// Full-screen fallback UI displayed when a fatal application error occurs
function ErrorPage({ error, errorInfo, onReset }) {
	const errorMessage = error?.message || error?.toString?.() || 'Unknown error';
	const componentStack = errorInfo?.componentStack;

	// NAVIGATION HANDLERS ---
	// Logic to escape the error state and return to a stable application state
	const handleGoHome = () => {
		onReset?.();
		window.location.href = '/';
	};

	const handleRefresh = () => {
		window.location.reload();
	};

	// COMPONENT RENDERING ---
	return (
		<error-page style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			minHeight: '100vh',
			padding: '2rem',
			background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
			color: '#e8e8e8',
			fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
			textAlign: 'center',
			overflow: 'auto',
		}}>
			{/* VISUAL INDICATOR --- */}
			<div style={{
				animation: 'pulse 2s ease-in-out infinite',
				marginBottom: '1.5rem',
			}}>
				<ErrorIcon />
			</div>

			{/* HEADER AND DESCRIPTION --- */}
			<h1 style={{
				fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
				fontWeight: '700',
				color: '#e74c3c',
				margin: '0 0 0.5rem 0',
				textShadow: '0 2px 10px rgba(231, 76, 60, 0.3)',
			}}>
				Něco se pokazilo
			</h1>

			<p style={{
				fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
				color: '#a0a0a0',
				margin: '0 0 2rem 0',
				maxWidth: '500px',
				lineHeight: '1.6',
			}}>
				Omlouváme se, ale nastala neočekávaná chyba. Zkuste obnovit stránku nebo se vraťte na úvodní obrazovku.
			</p>

			{/* ACTION CONTROLS --- */}
			<div style={{
				display: 'flex',
				gap: '1rem',
				flexWrap: 'wrap',
				justifyContent: 'center',
				marginBottom: '2rem',
			}}>
				<button
					onClick={handleGoHome}
					style={{
						padding: '0.9rem 2rem',
						fontSize: '1rem',
						fontWeight: '600',
						border: 'none',
						borderRadius: '8px',
						cursor: 'pointer',
						background: 'linear-gradient(135deg, #3498db, #2980b9)',
						color: '#fff',
						boxShadow: '0 4px 15px rgba(52, 152, 219, 0.3)',
						transition: 'transform 0.2s, box-shadow 0.2s',
					}}
					onMouseOver={e => {
						e.currentTarget.style.transform = 'translateY(-2px)';
						e.currentTarget.style.boxShadow = '0 6px 20px rgba(52, 152, 219, 0.4)';
					}}
					onMouseOut={e => {
						e.currentTarget.style.transform = 'translateY(0)';
						e.currentTarget.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
					}}
				>
					Zpět na úvod
				</button>

				<button
					onClick={handleRefresh}
					style={{
						padding: '0.9rem 2rem',
						fontSize: '1rem',
						fontWeight: '600',
						border: '2px solid #e74c3c',
						borderRadius: '8px',
						cursor: 'pointer',
						background: 'transparent',
						color: '#e74c3c',
						transition: 'transform 0.2s, background 0.2s, color 0.2s',
					}}
					onMouseOver={e => {
						e.currentTarget.style.transform = 'translateY(-2px)';
						e.currentTarget.style.background = '#e74c3c';
						e.currentTarget.style.color = '#fff';
					}}
					onMouseOut={e => {
						e.currentTarget.style.transform = 'translateY(0)';
						e.currentTarget.style.background = 'transparent';
						e.currentTarget.style.color = '#e74c3c';
					}}
				>
					Obnovit stránku
				</button>
			</div>

			{/* TECHNICAL DEBUGGING SECTION --- */}
			{(errorMessage || componentStack) && (
				<details style={{
					width: '100%',
					maxWidth: '700px',
					textAlign: 'left',
					background: 'rgba(0, 0, 0, 0.3)',
					borderRadius: '8px',
					overflow: 'hidden',
				}}>
					<summary style={{
						padding: '1rem 1.5rem',
						cursor: 'pointer',
						fontSize: '0.95rem',
						color: '#888',
						borderBottom: '1px solid rgba(255,255,255,0.1)',
						userSelect: 'none',
					}}>
						Technické detaily
					</summary>
					<div style={{
						padding: '1rem 1.5rem',
						maxHeight: '300px',
						overflow: 'auto',
					}}>
						{errorMessage && (
							<div style={{ marginBottom: '1rem' }}>
								<span style={{ color: '#e74c3c', fontWeight: '600', fontSize: '0.85rem' }}>Error:</span>
								<pre style={{
									margin: '0.5rem 0 0 0',
									padding: '0.75rem',
									background: 'rgba(231, 76, 60, 0.1)',
									borderRadius: '4px',
									fontSize: '0.8rem',
									color: '#ccc',
									whiteSpace: 'pre-wrap',
									wordBreak: 'break-word',
									fontFamily: '"Fira Code", "Consolas", monospace',
								}}>
									{errorMessage}
								</pre>
							</div>
						)}
						{componentStack && (
							<div>
								<span style={{ color: '#f39c12', fontWeight: '600', fontSize: '0.85rem' }}>Component Stack:</span>
								<pre style={{
									margin: '0.5rem 0 0 0',
									padding: '0.75rem',
									background: 'rgba(243, 156, 18, 0.1)',
									borderRadius: '4px',
									fontSize: '0.75rem',
									color: '#999',
									whiteSpace: 'pre-wrap',
									wordBreak: 'break-word',
									fontFamily: '"Fira Code", "Consolas", monospace',
									maxHeight: '150px',
									overflow: 'auto',
								}}>
									{componentStack}
								</pre>
							</div>
						)}
					</div>
				</details>
			)}

			<style>{`
				@keyframes pulse {
					0%, 100% { opacity: 1; transform: scale(1); }
					50% { opacity: 0.8; transform: scale(0.95); }
				}
			`}</style>
		</error-page>
	);
}

export default ErrorPage;

