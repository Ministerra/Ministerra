import { memo, useEffect } from 'react';

/** ----------------------------------------------------------------------------
 * ContentEndBanner Component
 * Displays end-of-content message and serves as infinite scroll trigger.
 * --------------------------------------------------------------------------- */
function ContentEndBanner({ infinityTrigger, content, contQueue, disableInfinite, firstBatchReady, snap, contentMan }) {
	// INFINITE SCROLL OBSERVER ---------------------------
	useEffect(() => {
		const callInfiniteFetch = entries =>
			entries.forEach(e => {
				if (!disableInfinite.current && firstBatchReady.current && e.isIntersecting && !snap.fetch && contQueue.current.length && content?.length >= 20) contentMan(true);
			});
		const infiniteObserver = new IntersectionObserver(callInfiniteFetch, { rootMargin: '50%' });
		if (infinityTrigger.current) infiniteObserver.observe(infinityTrigger.current);
		return () => infiniteObserver?.disconnect();
	}, [content, snap.fetch]);

	return (
		<end-content ref={infinityTrigger} class='  padBotM block     iw80 w100 textAli'>
			{content && !contQueue.current.length && (
				<end-content class=' imw40 justCen aliCen flexCol '>
					<img src='/icons/placeholdergood.png' alt='' />
					<p className='xBold fsF'>Všechny události načteny</p>
				</end-content>
			)}
		</end-content>
	);
}

export default memo(ContentEndBanner);
