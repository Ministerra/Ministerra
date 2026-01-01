import { humanizeDateTime } from '../../../helpers';
import SimpleProtocol from '../SimpleProtocol';
import { useState } from 'react';
import MenuButtons from './stripButtonsJSX';
import { showUsersProfile } from '../../utils/userProfileUtils';

/** ----------------------------------------------------------------------------
 * MESSAGE MENU STRIP COMPONENT
 * Manages action menu for individual chat messages (edit, delete, reply, copy, punish).
 * -------------------------------------------------------------------------- */
const MessMenuStrip = ({ obj, chatObj, brain, setModes, chatMan, modes, setStatus }) => {
	const role = chatObj.members?.find(member => member.id === brain.user.id)?.role,
		hasRole = role === 'VIP' || role === 'admin' || role === 'guard';
	const [selButton, setSelButton] = useState(null);
	const { created, id, content, user, own } = obj;
	const { members } = chatObj;
	const [copied, setCopied] = useState(false);
	const targetMember = members?.find(m => m.id === user); // TARGET USER FOR PUNISH ------

	// SET MODE HELPER -------------------------------------------------------
	const setMode = (activeMode, value) =>
		setModes(prev => ({
			...prev,
			[activeMode]: value !== undefined ? value : !prev[activeMode],
		}));

	// BUTTONS MAP OBJECT ----------------------------------------------------
	const src = {
		sdílet: () => chatMan({ mode: 'shareMessage', messID: id }),
		editovat: Date.now() - new Date(created).getTime() < 1000 * 60 * 15 && own ? () => setModes(prev => ({ ...prev, textArea: !prev.textArea, menu: false })) : null,
		smazat:
			(Date.now() - new Date(created).getTime() < 1000 * 60 * 15 && own) || (!own && (role === 'VIP' || (role === 'admin' && ['guard', 'member', undefined].includes(role))))
				? async () => (await chatMan({ mode: 'deleteMessage', messID: id }), setModes(prev => ({ ...prev, menu: false })))
				: null,
		nahlásit: !own ? () => setModes(prev => ({ ...prev, protocol: prev.protocol === 'report' ? false : 'report' })) : null,
		potrestat: !own && hasRole && chatObj.type !== 'private' && targetMember?.role === 'member' ? () => setMode('protocol', modes.protocol === 'punish' ? null : 'punish') : null, // PUNISH BUTTON ------
		kopírovat: () => {
			setCopied(prev => (!prev ? true : 'info'));
			const userData = members.find(member => member.id == user);
			const formattedData = `Uživatel: ${userData.first} ${userData.last}\nKdy: ${humanizeDateTime({ dateInMs: created })}\nZpráva: ${content}\n`;
			navigator.clipboard.writeText(formattedData).catch(err => console.error('Could not copy text: ', err));
			setCopied(!copied ? true : 'info');
		},
		profil: () => showUsersProfile({ obj, brain, chatObj, setModes, modes, setStatus }),
	};

	// RENDER ------------------------------------------------------------------
	return (
		<message-menu>
			<MenuButtons {...{ src, thisIs: 'message', selButton, setSelButton, modes, setMode, copied }} />

			{modes.protocol && (
				<SimpleProtocol
					setModes={setModes}
					target={modes.protocol === 'punish' ? user : obj.id}
					modes={modes}
					thisIs={modes.protocol === 'punish' ? 'user' : 'message'}
					brain={brain}
					setStatus={setStatus}
					superMan={chatMan}
					chatObj={chatObj}
					chatID={chatObj?.id}
					obj={targetMember}
					role={role}
				/>
			)}
		</message-menu>
	);
};

export default MessMenuStrip;
