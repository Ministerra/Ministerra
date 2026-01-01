// REUSABLE SPACING COMPONENT ---
// Renders a block-level div with dynamic height for vertical spacing
export const EmptyDiv = props => {
	return <div onClick={props.onClick} className={`${props.height} block`} />;
};

// BOTTOM SPACING COMPONENT ---
// Specialized version for footer/bottom spacing without block restriction
export const EmptyDivBottom = props => {
	return <div className={props.height} />;
};
