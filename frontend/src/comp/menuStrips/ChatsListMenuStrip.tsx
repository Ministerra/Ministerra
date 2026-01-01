import { useState } from 'react';
import MenuButtons from './stripButtonsJSX';

// TODO put smazat under "sprava" and create option to hide event but keep the data.
/** ----------------------------------------------------------------------------
 * CHATS LIST MENU STRIP
 * Provides quick filters (archived, inactive, hidden) for the chats list view.
 * Delegates rendering to MenuButtons while tracking selected button locally.
 * --------------------------------------------------------------------------- */
const ChatsListMenuStrip = props => {
	const { chatMan, modes = {}, notifDots = {} } = props,
		[selButton, setSelButton] = useState(null);

	// MAP FILTER BUTTONS TO BACKEND MODES ----------------------------------
	const src = { archiv: () => chatMan({ mode: 'getArchivedChats' }), neaktivní: () => chatMan({ mode: 'getInactiveChats' }), skryté: () => chatMan({ mode: 'getHiddenChats' }) };

	return (
		<menu-strip>
			<MenuButtons {...{ src, thisIs: 'chatsList', selButton, setSelButton, modes, notifDots }} />
		</menu-strip>
	);
};

export default ChatsListMenuStrip;
