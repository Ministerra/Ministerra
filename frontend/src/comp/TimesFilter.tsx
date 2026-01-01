import useCentralFlex from '../hooks/useCentralFlex';

const times = ['anytime', 'recent', 'today', 'tomorrow', 'weekend', 'week', 'nextWeek', 'month', 'twoMonths'];

function TimesFilter({ time, avail, snapMan, setShow, show, timeLabel }) {
	const bWidth = useCentralFlex('timesFilter', [avail.times?.length], null, times.length);

	return (
		<times-filter class='posRel wrap marTopS borTopLight   overHidden bInsetBlueTop flexCen marAuto w100'>
			{times.map(t => {
				const isSel = time === t,
					emptyTimeFrame = (t !== 'anytime' && !avail.times?.includes(t)) || (!avail.times.length && t === 'anytime');
				return (
					<button
						disabled={emptyTimeFrame}
						key={t}
						name={t}
						style={{ maxWidth: bWidth }}
						onClick={() => (time !== t && snapMan('time', t), setShow({ ...show, times: false }))}
						className={`${isSel && emptyTimeFrame ? 'bRed tWhite' : emptyTimeFrame ? 'tDis' : ''}  ${
							isSel ? 'bInsetBlueBotXl boRadXxs fs17 tSha10 borTop4 tWhite xBold ' : 'borBotLight bgTransXs fs11 textSha  '
						} bHover mh5 hvw9 grow w100 h100 `}>
						{timeLabel[t]}
					</button>
				);
			})}
		</times-filter>
	);
}

export default TimesFilter;











