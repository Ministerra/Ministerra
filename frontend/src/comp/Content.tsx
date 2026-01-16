// CONTENT FEED COMPONENT ---
// Manages dynamic content feeds (events/users) with infinite scroll and masonry layouts.
import { useState, useRef, memo } from 'react';
import Masonry from './Masonry';
import useMasonResize from '../hooks/useMasonResize';
import EventCard from './EventCard';
import UserCard from './UserCard';
import { useContentFetch } from '../hooks/useContentFetch';
import ContentControls from './content/ContentControls';
import ContentEndBanner from './content/ContentEndBanner';

// CONTENT SHELL COMPONENT DEFINITION ---
// Manages the main feed of events and users with masonry layout and infinite scroll
function Content(props) {
	const { fadedIn = [], nowAt, brain, avail, snap = {}, provideSnap = () => {}, event = {}, eveInter, map, setSnap, show = {}, sherData, isMobile, disableResize } = props;

	// STATE AND REFS ---
	const [infinityTrigger, contentRef] = [useRef(), useRef()],
		[showMore, setShowMore] = useState(nowAt === 'event' ? false : true);
	const isPast = event.ends > event.starts && new Date(new Date().setHours(0, 0, 0, 0)).getTime() > (event.ends || event.starts);
	const contView = snap.contView || (nowAt === 'event' ? 'users' : 'events'),
		isPastUsers = isPast && contView === 'users';
	const [viewCols, setViewCols] = useState(false),
		[content, setContent] = useState(null),
		[showAllThumbs, setShowAllThumbs] = useState(brain.user.settings.showAllThumbs);

	// CONTENT DATA SETTER ---
	// Updates content items and recalculates columns based on container width.
	function setCardsToContent(data, cols) {
		const isRef = !data;
		(data ??= content),
			(cols ??= Math.min(Math.floor(contentRef.current.offsetWidth / 360), brain.user.cols[isPastUsers ? 'pastUsers' : contView], data?.length || 1, nowAt === 'event' ? 4 : Infinity));
		if (cols && !data) return;
		setShowAllThumbs(brain.user.settings.showAllThumbs), setNumOfCols(cols), setContent(isRef ? [...data] : data);
	}

	// MASONRY RESIZE HOOK ---
	const [numOfCols, setNumOfCols, scaleFactor] = useMasonResize({
		wrapper: contentRef,
		disableResize,
		contType: isPastUsers ? 'pastUsers' : contView,
		contLength: nowAt !== 'home' && !showMore ? Math.min(content?.length || 0, isPast ? 20 : 4) : content?.length,
		fetching: snap.fetch,
		brain,
		isMobile,
		contSetter: content ? setCardsToContent : null,
		nowAt,
	});
	const maxCols = isMobile ? 1 : Math.floor((contentRef.current?.offsetWidth / 360) * scaleFactor);

	// CONTENT FETCH HOOK ---
	const { contQueue, disableInfinite, firstBatchReady, contentMan } = useContentFetch({
		brain,
		snap,
		avail,
		event,
		show,
		sherData,
		nowAt,
		contView,
		isPast,
		content,
		setContent,
		setCardsToContent,
		contentRef,
		setSnap,
		map,
		provideSnap,
		eveInter,
	});

	// RENDER PROPS ---
	const Comp = contView === 'events' ? EventCard : UserCard;
	const cardProps = { brain, cols: numOfCols, cardsView: brain.user.cardsView[contView] || 1, selTypes: new Set(snap.types), isPast, eveInter, showAllThumbs, nowAt, isMobile };

	// MAIN JSX RENDER ---
	return (
		<content-comp
			id='content'
			class={`fadingIn ${fadedIn.includes('Content') ? 'fadedIn' : ''} ${nowAt !== 'event' ? 'mihvh140' : ''} fPadHorXxs posRel w100 posRel block marAuto`}
			ref={contentRef}>
			{/* SECTION DIVIDER --- */}
			{nowAt !== 'event' && <blue-divider style={{ filter: 'saturate(0.7) hue-rotate(0deg)' }} class='hr4 marBotL noPoint block zin0 maskLowXs w70 opacityS marAuto' />}

			{/* CONTENT CONTROLS --- */}
			{nowAt === 'home' && show.view !== 'topEvents' && (
				<ContentControls
					brain={brain}
					snap={snap}
					avail={avail}
					contView={contView}
					numOfCols={numOfCols}
					maxCols={maxCols}
					viewCols={viewCols}
					setViewCols={setViewCols}
					showAllThumbs={showAllThumbs}
					setCardsToContent={setCardsToContent}
					contentLength={content?.length || 0}
				/>
			)}

			{/* MASONRY GRID --- */}
			{!snap.fetch && content?.length && numOfCols && (
				<Masonry
					key={`${window.location.pathname}`}
					superMan={contentMan}
					content={content?.slice(
						0,
						nowAt !== 'event' && content?.length % 20 !== 0 && contQueue.current.length
							? content.length - (content.length % 20)
							: nowAt !== 'home' && !showMore
							? isPast
								? 20
								: 4
							: undefined
					)}
					config={{ contType: contView, numOfCols }}
					nowAt={nowAt}
					snap={snap}
					isMobile={isMobile}
					brain={brain}
					Comp={Comp}
					cardProps={cardProps}
				/>
			)}

			{/* PAGINATION BUTTONS --- */}
			{nowAt === 'event' && (
				<buttons-div class='flexCen w80  bw50 posRel bmw30 marAuto moveUp bPadXxs zinMaXl'>
					{showMore && content?.length > (isPast ? 20 : 4) && (
						<button
							onClick={() => (setShowMore(false), setTimeout(() => window.scroll({ top: contentRef.current.offsetTop, behavior: 'smooth' }), 100))}
							className='mw40 bDarkBlue borRed tWhite bHover xBold fs7 boRadXs'>
							Sbalit
						</button>
					)}
					{(contQueue.current.length || (!showMore && content?.length > (isPast ? 20 : 4))) && (
						<button
							onClick={() => (!showMore && content.length > (isPast ? 20 : 4) ? setShowMore(true) : (contentMan(true), !showMore && setShowMore(true)))}
							className='bInsetBlueTopXs   bBor posRel maskLowXs  shaBot bHover  tDarkBlue xBold fs14 boRadXxxs'>
							Další
						</button>
					)}
				</buttons-div>
			)}

			{/* INFINITE SCROLL BANNER --- */}
			{nowAt === 'home' && (
				<ContentEndBanner
					infinityTrigger={infinityTrigger}
					content={content}
					contQueue={contQueue}
					disableInfinite={disableInfinite}
					firstBatchReady={firstBatchReady}
					snap={snap}
					contentMan={contentMan}
				/>
			)}
		</content-comp>
	);
}

// PERFORMANCE OPTIMIZATION ---
function propsEqual(prev, next) {
	return (
		prev.eveInter === next.eveInter &&
		prev.snap.fetch === next.snap.fetch &&
		prev.map === next.map &&
		prev.nowAt === next.nowAt &&
		prev.fadedIn === next.fadedIn &&
		prev.disableResize === next.disableResize &&
		prev.showAllThumbs === next.showAllThumbs &&
		prev.isMobile === next.isMobile &&
		prev.brain?.user?.settings?.showAllThumbs === next.brain?.user?.settings?.showAllThumbs
	);
}

export default memo(Content, propsEqual);
