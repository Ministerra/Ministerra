# Frontend Development Notes

> Personal development notes organized by file/feature.
> Originally inline comments, consolidated here for easy reference.

---

## App.jsx - Main Application

### TODOs

-   [ ] Might want to create a worker to process and cleanup brain in general when starting app
-   [ ] Possibly fetch metas when fastLoaded and user opens galleryIDs, instead of fetching metas/basics individually
-   [ ] The interaction interval needs to store only if there was a mouse interaction (for each mouseclick, set timestamp in brain, and then check if there was a mouseclick in the last 30 seconds)
-   [ ] Show visual indicator, that data is being saved, so that users don't close the window prematurely
-   [ ] Might need to move the pastEve deletion to galleryIDs, otherwise the entire pastEve would have to be decrypted on init
-   [ ] Need to create interval to get rid of very old past events + track when they were last opened
-   [ ] Replace const path in foundation loader with the url parsing from navigate and loader params
-   [ ] Need to implement auth rotation somehow. Either full, or procedural using backwards calculation
-   [ ] Store events under city IDs in local storage, find out efficient way to progressively delete events from cities which user is not interested in
-   [ ] Convert all arrays to objects {id: value}
-   [ ] Implement limiting of number of stored items in local storage = by number as well as timestamps (?)
-   [ ] Implement some kind of one time alert for when there is too much data in local storage. Create a flag to only ping our server once
-   [ ] Only replace problematic parts of brain, not the whole brain
-   [ ] Need to check if we remove locally cached data everywhere when server does not return them if requested. Might need to implement some sort of counter and store it in some kind of map. Remove it from local if count reaches 3 unsuccessful requests.
-   [ ] Implement auth rotation, currently not possible, since it breaks down decrypting of previously stored stuff
-   [ ] Could probably ask user for password every time he comes back and generate the btoa or some other key from that. (in case of password change, need to re-encrypt everything)
-   [ ] When deleting tempfiles from galleryIDs for example, maybe base it on the items sync, not a ttl timestamp, because that always deletes everything, even if some items are not stale yet.

### BUGs

-   [ ] design2 in eveCards is broken when viewing microprofile of attendees
-   [ ] Implement a last resort local reset, which would be based on a time based counters of app init into an error page (so the app doesn't load at all) and if there are 3 fatal failures in less than 24 hours and at least 8 hours apart (it would clear sensitive data from indexed db/workers) and the app would simply start from scratch. If that doesn't help, we could flush completely everything from the frontend. It would be complex, but worth it.

### Info

-   Setup server to send some bullshit responses on all gets/posts and see what happens.

---

## helpers.jsx - Core Helpers

### TODOs

-   [ ] When event is deleted, store only the title and show it in the search or gallery as deleted
-   [ ] Put another key (masterkey) into env
-   [ ] Probably store all sensitive brain.user props in the worker as well???
-   [ ] Implement ends of events into metas (big task)

### BUGs

-   [ ] If user deletes just the user object, it probably won't sync a new user from foundation

### Info

-   If users create a friendly meeting, he should be able to choose between surely / maybe attendance, AND this attendance should be indicated on the card / event as long as there is no user having the surely attendance. Otherwise it wouldn't be apparent which friendlyMeetings are serious and which ones are "lets see what happens"

---

## Content.jsx

### TODOs

-   [ ] Might want to create a tabulka před odhlášením. For example save to bookmarks or create icon on desktop
-   [ ] Use hash function to quickly compare interactions arrays and also be able to store them as individual map snaps for individual map viewports. PAKO library
-   [ ] Possibly to optimize even further, we could send only the metas to the user that he requests on the first filter fetch.
-   [ ] Same goes for attenEvees, we could probably send attenEvees list only for the events the users filters out. And then gradually send more, (but maybe not)
-   [ ] Need to implement visuals / interactions for deleted
-   [ ] Figure out, how not to duplicate the numOfCols and contView states in Masonry and Content
-   [ ] Create hook for infinite scroll
-   [ ] Currently when unstable Dev, and there is a lot of usable content (more than 20), it will ask for as much SQL only at the same time. The SQL only is not paginating (maybe it doesn't have to, maybe this is better)
-   [ ] Careful with the stat: 'del' assignment after fetch, check it thoroughly on backend

### BUGs

-   [ ] There is an issue with reference to contQueue items being lost when foundationLoader contentRestoral finishes.

### Ideas

-   Might try using content key as the event interests, so that it recalculates without the need of this layout effect

---

_Last updated: December 2024_
