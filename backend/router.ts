import { Router } from 'express';
import { Entrance } from './modules/entrance/index';
import { Foundation } from './modules/foundation';
import { Interests } from './modules/interests';
import { Event } from './modules/event';
import { Rating } from './modules/rating';
import { Content } from './modules/content';
import Report from './modules/report';
import { Discussion } from './modules/discussion';
import { Search } from './modules/search';
import Gallery from './modules/gallery';
import { User } from './modules/user';
import { Editor } from './modules/editor/index';
import { Images } from './modules/images';
import { Setup } from './modules/setup/index';
import { Chat } from './modules/chat';
import Alerts from './modules/alerts';
import { Invites } from './modules/invites';
import { Locations } from './modules/locations';
import Devices from './modules/devices';
import Feedback from './modules/feedback';

// ROUTER REGISTRY --------------------------------------------------------------
// Central HTTP route wiring for the backend.
// Keeps the request surface explicit: each endpoint maps to one module handler.
const router = Router();

// ASYNC ROUTE WRAPPER ----------------------------------------------------------
// Ensures async handlers propagate errors into Express error middleware instead of
// creating unhandled promise rejections (which can crash the process).
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ENTRANCE ---------------------------------------------------------------------
// Auth entry-point:
// - GET: auth verification via query param (email links use ?auth=token format)
// - POST: login/register/forgot flows via body mode
router.get('/entrance', asyncRoute(Entrance));
router.post('/entrance', asyncRoute(Entrance));

// CORE MODULES -----------------------------------------------------------------
// Main API surface for core domain objects.
router.post('/foundation', asyncRoute(Foundation));
router.post('/event', asyncRoute(Event));
router.post('/gallery', asyncRoute(Gallery));
router.post('/user', asyncRoute(User));
router.post('/content', asyncRoute(Content));
router.post('/discussion', asyncRoute(Discussion));
router.post('/report', asyncRoute(Report));

// UTILITIES & SETUP ------------------------------------------------------------
// Setup/editor routes include `Images` middleware for upload/asset handling.
router.post('/editor', Images, asyncRoute(Editor));
router.post('/setup', Images, asyncRoute(Setup));
router.post('/interests', asyncRoute(Interests));
router.post('/locations', asyncRoute(Locations));

// FEATURE MODULES --------------------------------------------------------------
// Secondary features that still share the same auth/middleware stack.
router.post('/rating', asyncRoute(Rating));
router.post('/search', asyncRoute(Search));
router.post('/chat', asyncRoute(Chat));
router.post('/alerts', asyncRoute(Alerts));
router.post('/invites', asyncRoute(Invites));
router.post('/devices', asyncRoute(Devices));
router.post('/feedback', asyncRoute(Feedback));

export default router;
