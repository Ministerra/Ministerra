// SHARED CONSTANTS ---
// Centralized configuration variables used across the frontend application.

// USER PROFILE FIELDS ---
// Defines the columns/keys synchronized for user profile and setup operations.
export const userSetupCols = [
	'first',
	'image',
	'age',
	'id',
	'last',
	'favs',
	'exps',
	'cities',
	'priv',
	'defPriv',
	'askPriv',
	'basics',
	'groups',
	'indis',
	'gender',
	'location',
	'shortDesc',
	'birth',
	'imgVers',
];

// REGEX PATTERNS ---
// Standard email validation pattern according to RFC standards.
export const emailCheck =
	/^(?=.{1,254})(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@(?:(?=[a-zA-Z0-9-]{1,63}\.)(xn--)?[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*\.){1,8}(?=[a-zA-Z]{2,63})(xn--[a-zA-Z0-9]{1,59})?[a-zA-Z]{2,63}$/;
