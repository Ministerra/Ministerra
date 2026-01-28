import { useState, useMemo, useEffect, useRef } from 'react';
import RateAwards from './RateAwards';
import SimpleProtocol from './SimpleProtocol';
import Invitations from './Invitations';
import TimeoutIndicator from './TimeoutIndicator';
import { blocksHandler, linksHandler } from '../hooks/useLinksAndBlocks';
import { showUsersProfile } from '../utils/userProfileUtils';

type ActiveView = 'main' | 'interactions' | 'rating' | 'menu';

// SUB-VIEW WRAPPER ---------------------------
const SubViewWrapper = ({ children }: { children: any }) => <div className="flexCol w100 bInsetBlueTopXs2 aliCen posRel fadingIn fadedIn">{children}</div>;

// MAIN COMPONENT ---
function UserActionsBs({ obj, brain, status, setStatus, modes, setModes, isPast, isStrip, chatObj = {}, galleryMode = '', nowAt = '', superMan = null, UserCardComp = null }: any) {
	const [activeView, setActiveView] = useState<ActiveView>('main');
	const [timerProgress, setTimerProgress] = useState(0);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState(null);
	const intervalRef = useRef<any>();

	// HANDLE BACK TO MAIN MENU ---------------------------
	const goBack = () => setActiveView('main');

	// TIMER LOGIC ---------------------------
	const resetTimer = () => {
		clearInterval(intervalRef.current);
		const duration = 4000;
		const start = Date.now();
		intervalRef.current = setInterval(() => {
			const elapsed = Date.now() - start;
			const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
			setTimerProgress(remaining);
			if (remaining <= 0) {
				clearInterval(intervalRef.current);
				goBack();
			}
		}, 50);
	};

	useEffect(() => {
		if (activeView !== 'main') resetTimer();
		else {
			clearInterval(intervalRef.current);
			setTimerProgress(0);
		}
		return () => clearInterval(intervalRef.current);
	}, [activeView]);

	// ACTION HELPERS ---------------------------
	const setMode = (m: string, v: any = undefined) => setModes((p: any) => ({ ...Object.keys(p).reduce((acc, k) => ({ ...acc, [k]: false }), {}), actions: true, [m]: v !== undefined ? v : !p[m] }));
	const propss = { brain, id: obj.id, obj, setStatus, setModes };

	const handleTrust = async () => {
		try {
			await linksHandler({ mode: 'trust', brain, id: obj.id, obj, setStatus, setModes });
			setSuccess(true);
			setError(null);
			setTimeout(() => (setSuccess(false), setModes((p: any) => ({ ...p, trust: false }))), 3000);
		} catch (e) {
			console.error(e);
			setError('Chyba :-( zkus to za chvilku znovu' as any);
			setTimeout(() => (setError(null), setModes((p: any) => ({ ...p, trust: false }))), 3000);
			setSuccess(false);
		}
	};

	// INTERACTION ACTIONS ---------------------------
	const interactionActions = {
		profil: !obj.blocked && !isPast && isStrip ? () => showUsersProfile({ obj, brain, chatObj, setModes, modes, setStatus }) : null,
		důvěřovat: !status.trusts && obj.linked === true ? () => setMode('trust') : null,
		připojit: !obj.blocked && !obj.trusts && !obj.linked && obj.id != brain.user.id ? () => setMode('protocol', 'link') : null,
		pozvat: !status.blocked && obj.id !== brain.user.id ? () => setMode('invites') : null,
		zpráva: !obj.blocked && (!chatObj.type || chatObj.type !== 'private') ? () => ((brain.newPrivateChat = { otherMember: obj }), setModes((p: any) => ({ ...p, menu: false })), goBack()) : null,
	};

	// MENU ACTIONS ---------------------------
	const menuActions = {
		blokovat: !status.blocked && obj.id !== brain.user.id ? () => blocksHandler({ ...propss, mode: 'block' }) : null,
		odblokovat: status.blocked ? () => blocksHandler({ ...propss, mode: 'unblock' }) : null,
		nahlásit: obj.id !== brain.user.id ? () => setMode('protocol', 'report') : null,
	};

	// MAIN CONTROL BAR ---------------------------
	const MainControlBar = (
		<div className="flexRow w100 noBackground  aliStretch">
			{isStrip && !obj.blocked && !isPast && (
				<button onClick={() => showUsersProfile({ obj, brain, chatObj, setModes, modes, setStatus })} className={`grow bBor padVerXxs posRel flexCol aliCen bHover bgTrans tDarkBlue`}>
					<img className={`mw3 aspect1610`} src="/icons/home.png" alt="" />
					<span className="fs5 bold">Profil</span>
				</button>
			)}

			<button onClick={() => setActiveView(activeView === 'interactions' ? 'main' : 'interactions')} className={`grow bBor ${activeView === 'interactions' ? 'bInsetBlueBotXs arrowDown1' : ''} padVerXxs posRel flexCol aliCen bHover bgTrans tDarkBlue`}>
				<img className={`${isStrip ? 'mw3' : 'mw5'} aspect1610`} src="/icons/people.png" alt="" />
				<span className="fs5 bold">Interakce</span>
			</button>

			{!isStrip && (
				<button onClick={() => setActiveView(activeView === 'rating' ? 'main' : 'rating')} className={`grow bBor ${activeView === 'rating' ? 'bInsetBlueBotXs arrowDown1' : ''} padVerXxs posRel flexCol aliCen bHover bgTrans tDarkBlue`}>
					<img className={`${isStrip ? 'mw3' : 'mw5'} aspect1610`} src="/icons/rating.png" alt="" />
					<span className="fs5 bold">Podpořit</span>
				</button>
			)}

			<button onClick={() => setActiveView(activeView === 'menu' ? 'main' : 'menu')} className={`wr6 bBor ${activeView === 'menu' ? 'bBlue tWhite arrowDown1' : 'tDarkBlue'} padVerXxs posRel  aliCen bHover bgTrans `}>
				<div className={`flexCol h50 spaceBet aliCen gapXxxxxs `}>
					<div className={`wr0-5 hr0-5 round ${activeView !== 'menu' ? 'bgBlack opacityXs' : 'bgWhite'} boRadM`} />
					<div className={`wr0-5 hr0-5 round ${activeView !== 'menu' ? 'bgBlack opacityXs' : 'bgWhite'} boRadM`} />
					<div className={`wr0-5 hr0-5 round ${activeView !== 'menu' ? 'bgBlack opacityXs' : 'bgWhite'} boRadM`} />
				</div>
			</button>
		</div>
	);

	const hide = ['protocol', 'profile', 'invites', 'trust'].some(b => modes[b]);

	return (
		<div onClick={e => e.stopPropagation()} className="fadedIn flexCol zinMenu posRel marTopXs aliStretch w100 bgWhite shaBotLight borBotLight boRadS" style={{ minHeight: '50px' }}>
			{!hide && MainControlBar}

			{activeView !== 'main' && !hide && <div className="hr0-2 zin1 block opacityM bInsetBlueTopXl bgTrans w80 marAuto" />}
			{activeView !== 'main' && activeView !== 'rating' && !hide && timerProgress > 0 && <TimeoutIndicator progress={timerProgress} invert={true} noRedColor={true} />}

			{activeView === 'interactions' && !hide && (
				<SubViewWrapper>
					<div className="flexRow aliStretch justCen zinMax padTopXxs w100 gapXxs">
						{Object.entries(interactionActions)
							.filter(([, v]) => v)
							.map(([label, action]) => (
								<button
									key={label}
									onClick={() => {
										(action as any)();
										goBack();
									}}
									className="bHover bBor grow posRel padVerXs flexCol aliCen boRadXxs bgTrans">
									<img className="mw6 aspect1610 marBotXxxs" src={`/icons/${label === 'profil' ? 'home' : label === 'důvěřovat' ? 'gallery/trusts' : label === 'připojit' ? 'alerts/link' : label === 'pozvat' ? 'alerts/invite' : 'chats'}.png`} alt="" />
									<span className="fs5 tGrey lh1">{label}</span>
								</button>
							))}
					</div>
				</SubViewWrapper>
			)}

			{activeView === 'rating' && !hide && (
				<SubViewWrapper>
					<RateAwards obj={obj} brain={brain} status={status} setStatus={setStatus} modes={modes} setModes={setModes} thisIs="user" goBack={goBack} resetTimer={resetTimer} />
				</SubViewWrapper>
			)}

			{activeView === 'menu' && !hide && (
				<SubViewWrapper>
					<div className="flexCen aliStretch zinMax padTopXxs w100 wrap">
						{Object.entries(menuActions)
							.filter(([, v]) => v)
							.map(([label, action]) => (
								<button
									key={label}
									onClick={() => {
										(action as any)();
										goBack();
									}}
									className="bHover bBor w33 posRel padVerXs flexCol aliCen boRadXxs bgTrans">
									<span className="fs5 tGrey lh1">{label}</span>
								</button>
							))}
					</div>
				</SubViewWrapper>
			)}

			{/* TRUST CONFIRMATION */}
			{modes.trust && (
				<div onClick={e => e.stopPropagation()} className="flexCol textAli padVerXs padHorS borTopLight shaComment bgWhite">
					<span className={`tDarkBlue xBold inlineBlock marTopS fs8 marBotXxxs`}>Přidat do důvěrných?</span>
					<span className="fs7 inlineBlock marBotS">Důvěrní uživatelé představují izolovaný seznam tvých spojenců s nimiž máš velmi vřelý vztah a chceš je mít možnost jednoduše zacílit svým obsahem (událostmi, komentáři apod.) a nebo dle potřeby omezit viditelnost (soukromí) tvého obsahu pouze na ně.</span>
					<button className={`${error ? 'bDarkRed' : success ? 'bDarkGreen' : 'bDarkBlue'} tWhite boRadXs padHorS padVerXs mw60 xBold marAuto w100 fs10`} onClick={handleTrust}>
						{error ? 'Chyba :-(, zkus to za chvilku znovu' : success ? 'ÚSPĚŠNĚ PROVEDENO!' : 'Ano přidat do důvěrných'}
					</button>
				</div>
			)}

			{/* SUB-COMPONENTS */}
			{modes.profile && UserCardComp && <UserCardComp obj={modes.profile} cardsView={brain.user.cardsView.users} isProfile={true} galleryMode={galleryMode} brain={brain} setModes={setModes} />}
			{modes.invites && <Invitations mode="userToEvents" brain={brain} obj={obj} onSuccess={() => setModes((p: any) => ({ ...p, menu: false, invite: false }))} setModes={setModes} />}
			{modes.protocol && <SimpleProtocol setModes={setModes} superMan={async (p: any) => (modes.protocol === 'punish' ? await superMan(p) : await linksHandler({ ...p, ...propss }))} obj={obj} target={obj.id} modes={modes} thisIs={'user'} brain={brain} nowAt={nowAt} setStatus={setStatus} chatObj={chatObj} chatID={chatObj?.id} />}

			{activeView === 'rating' && !hide && timerProgress > 0 && <TimeoutIndicator progress={timerProgress} invert={true} noRedColor={true} />}
		</div>
	);
}

export default UserActionsBs;
