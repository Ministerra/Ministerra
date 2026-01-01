import { useState, useEffect, useRef } from 'react';

// FADE-IN SEQUENCE CONFIGURATION ----------------------------------------------
// Steps: declare per-route/per-mode component keys in intended animation order; consumers push these keys into state to drive class-based transitions.
const COMPS = {
	transition: [],
	foundation: ['Foundation'],
	event: ['Image', 'TitleTexts', 'Content', 'Texts', 'BsEvent', 'RatingBs', 'TextArea', 'Entrance', 'Discussion', 'SortMenu'],
	home: ['Header', 'HeaderTexts', 'Quicks', 'CatFilter', 'Tools', 'Content'],
	setup: ['Personals', 'Cities', 'Indis', 'Basics', 'Favex', 'Picture', 'Groups'],
	editor: ['Image', 'CatFilter', 'Filter', 'IntroTexts', 'Cropper', 'EventInfo'],
	quick: ['fadedIn'],
};

/** ----------------------------------------------------------------------------
 * USE FADE IN HOOK
 * Manages the staggered fade-in animation of components for smooth transitions.
 * Supports manual reset and cancellation of pending animations.
 * -------------------------------------------------------------------------- */
function useFadeIn({ mode, dontFadeIn = false }) {
	const [fadedIn, setFadedIn] = useState(mode === 'foundation' ? ['Foundation'] : []),
		[reinitKey, setReinitKey] = useState(0), // Trigger re-animation when incremented
		didRun = useRef(false),
		timeoutIds = useRef([]);

	// WRAPPED SETTER -----------------------------------------------------------
	// Steps: detect external clear (set []), cancel pending timeouts, reset didRun, then bump reinitKey so effect restarts cleanly.
	const wrappedSetFadedIn = val => {
		if (Array.isArray(val) && val.length === 0) {
			// External clear detected - cancel pending timeouts and prepare for re-animation
			timeoutIds.current.forEach(id => clearTimeout(id));
			timeoutIds.current = [];
			didRun.current = false;
			setFadedIn([]);
			setReinitKey(k => k + 1); // Trigger effect re-run
		} else {
			setFadedIn(val);
		}
	};

	useEffect(() => {
		// ANIMATION SCHEDULER ------------------------------------------------
		// Steps: schedule per-key timeouts with mode-specific start+delay, push keys idempotently, and run only once unless externally reset via wrappedSetFadedIn.
		if (dontFadeIn || didRun.current) return;
		didRun.current = true;
		const items = COMPS[mode] || [],
			delay = mode === 'transition' ? 200 : 100,
			start = mode === 'quick' ? 0 : mode === 'transition' ? 500 : 200;
		// BATCH ALL FADES INTO SINGLE TIMEOUT CHAIN - NO RE-RENDERS DURING SCROLL ---------------------------
		items.forEach((comp, i) => {
			const id = setTimeout(() => setFadedIn(prev => (prev.includes(comp) ? prev : [...prev, comp])), start + i * delay);
			timeoutIds.current.push(id);
		});
	}, [mode, dontFadeIn, reinitKey]);
	
	return [fadedIn, wrappedSetFadedIn];
}

export default useFadeIn;
