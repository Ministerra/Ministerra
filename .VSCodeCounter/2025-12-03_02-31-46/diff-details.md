# Diff Details

Date : 2025-12-03 02:31:46

Directory c:\\Ministerra

Total : 136 files,  852 codes, 892 comments, 199 blanks, all 1943 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/app.js](/backend/app.js) | JavaScript | 30 | -1 | 5 | 34 |
| [backend/docker-compose.yml](/backend/docker-compose.yml) | YAML | 8 | 0 | 1 | 9 |
| [backend/docs/mysql-read-replica.md](/backend/docs/mysql-read-replica.md) | Markdown | 4 | 0 | 0 | 4 |
| [backend/dump.sql](/backend/dump.sql) | MS SQL | 814 | 186 | 124 | 1,124 |
| [backend/migrations/001\_user\_devices.sql](/backend/migrations/001_user_devices.sql) | MS SQL | 14 | 2 | 4 | 20 |
| [backend/migrations/002\_chat\_indices.sql](/backend/migrations/002_chat_indices.sql) | MS SQL | 1 | 2 | 1 | 4 |
| [backend/ministerra\_dump.sql](/backend/ministerra_dump.sql) | MS SQL | 0 | 0 | 1 | 1 |
| [backend/modules/Chat/chatHelpers.js](/backend/modules/Chat/chatHelpers.js) | JavaScript | 31 | 8 | 5 | 44 |
| [backend/modules/Chat/messageHandlers.js](/backend/modules/Chat/messageHandlers.js) | JavaScript | -5 | -2 | -4 | -11 |
| [backend/modules/Chat/quickQueries.js](/backend/modules/Chat/quickQueries.js) | JavaScript | 6 | 5 | 5 | 16 |
| [backend/modules/Chat/seenSync.js](/backend/modules/Chat/seenSync.js) | JavaScript | 2 | 2 | 0 | 4 |
| [backend/modules/alerts.js](/backend/modules/alerts.js) | JavaScript | 4 | 23 | 1 | 28 |
| [backend/modules/chat.js](/backend/modules/chat.js) | JavaScript | 58 | 26 | 3 | 87 |
| [backend/modules/content.js](/backend/modules/content.js) | JavaScript | 0 | 11 | 0 | 11 |
| [backend/modules/devices.js](/backend/modules/devices.js) | JavaScript | 46 | 6 | 13 | 65 |
| [backend/modules/discussion.js](/backend/modules/discussion.js) | JavaScript | 6 | 18 | 3 | 27 |
| [backend/modules/editor.js](/backend/modules/editor.js) | JavaScript | -346 | -34 | -46 | -426 |
| [backend/modules/editor/index.js](/backend/modules/editor/index.js) | JavaScript | 227 | 30 | 40 | 297 |
| [backend/modules/editor/sanitize.js](/backend/modules/editor/sanitize.js) | JavaScript | 152 | 18 | 24 | 194 |
| [backend/modules/entrance.js](/backend/modules/entrance.js) | JavaScript | 14 | 12 | 2 | 28 |
| [backend/modules/event.js](/backend/modules/event.js) | JavaScript | 10 | 17 | 3 | 30 |
| [backend/modules/foundation.js](/backend/modules/foundation.js) | JavaScript | 46 | 21 | 3 | 70 |
| [backend/modules/gallery.js](/backend/modules/gallery.js) | JavaScript | 2 | 7 | 2 | 11 |
| [backend/modules/images.js](/backend/modules/images.js) | JavaScript | 3 | 9 | 1 | 13 |
| [backend/modules/interests.js](/backend/modules/interests.js) | JavaScript | 2 | 5 | 1 | 8 |
| [backend/modules/invites.js](/backend/modules/invites.js) | JavaScript | 4 | 7 | 3 | 14 |
| [backend/modules/jwtokens.js](/backend/modules/jwtokens.js) | JavaScript | 0 | 9 | 1 | 10 |
| [backend/modules/locations.js](/backend/modules/locations.js) | JavaScript | 6 | 6 | 2 | 14 |
| [backend/modules/mailing.js](/backend/modules/mailing.js) | JavaScript | 0 | 5 | 1 | 6 |
| [backend/modules/rating.js](/backend/modules/rating.js) | JavaScript | 1 | 10 | 1 | 12 |
| [backend/modules/report.js](/backend/modules/report.js) | JavaScript | 7 | 7 | 3 | 17 |
| [backend/modules/search.js](/backend/modules/search.js) | JavaScript | 6 | 6 | 2 | 14 |
| [backend/modules/setup/index.js](/backend/modules/setup/index.js) | JavaScript | 12 | 13 | 0 | 25 |
| [backend/modules/setup/sanitize.js](/backend/modules/setup/sanitize.js) | JavaScript | 0 | 33 | 1 | 34 |
| [backend/modules/user.js](/backend/modules/user.js) | JavaScript | 3 | 12 | 0 | 15 |
| [backend/router.js](/backend/router.js) | JavaScript | 2 | 0 | 0 | 2 |
| [backend/systems/handlers/circuitBreaker.js](/backend/systems/handlers/circuitBreaker.js) | JavaScript | 18 | 2 | 3 | 23 |
| [backend/systems/handlers/emitter.js](/backend/systems/handlers/emitter.js) | JavaScript | 107 | 8 | 10 | 125 |
| [backend/systems/handlers/loggers.js](/backend/systems/handlers/loggers.js) | JavaScript | -986 | 13 | -134 | -1,107 |
| [backend/systems/handlers/streamUtils.js](/backend/systems/handlers/streamUtils.js) | JavaScript | 9 | -2 | 0 | 7 |
| [backend/systems/handlers/streamer.js](/backend/systems/handlers/streamer.js) | JavaScript | 7 | 4 | 2 | 13 |
| [backend/systems/mysql/mysql.js](/backend/systems/mysql/mysql.js) | JavaScript | 65 | 0 | 6 | 71 |
| [backend/systems/redis/redis.js](/backend/systems/redis/redis.js) | JavaScript | 20 | 0 | 0 | 20 |
| [backend/systems/socket/chatHandlers.js](/backend/systems/socket/chatHandlers.js) | JavaScript | 57 | 17 | 14 | 88 |
| [backend/systems/socket/socket.js](/backend/systems/socket/socket.js) | JavaScript | -332 | 35 | -20 | -317 |
| [backend/systems/worker/worker.js](/backend/systems/worker/worker.js) | JavaScript | 1 | 0 | 0 | 1 |
| [backend/tasks/chatMessages.js](/backend/tasks/chatMessages.js) | JavaScript | -1 | 0 | 0 | -1 |
| [backend/tasks/comments.js](/backend/tasks/comments.js) | JavaScript | 2 | 0 | 0 | 2 |
| [backend/tasks/dailyRecalc.js](/backend/tasks/dailyRecalc.js) | JavaScript | -21 | 0 | -7 | -28 |
| [backend/tasks/flagChanges.js](/backend/tasks/flagChanges.js) | JavaScript | 1 | 0 | 0 | 1 |
| [backend/tasks/userInteractions.js](/backend/tasks/userInteractions.js) | JavaScript | 8 | 3 | 1 | 12 |
| [backend/utilities/contentFilters.js](/backend/utilities/contentFilters.js) | JavaScript | -47 | -6 | -6 | -59 |
| [backend/utilities/contentHelpers.js](/backend/utilities/contentHelpers.js) | JavaScript | 22 | 12 | 1 | 35 |
| [backend/utilities/helpers.js](/backend/utilities/helpers.js) | JavaScript | 106 | 56 | 19 | 181 |
| [backend/utilities/helpers\_backup.js](/backend/utilities/helpers_backup.js) | JavaScript | 203 | 21 | 25 | 249 |
| [backend/utilities/helpers\_new.js](/backend/utilities/helpers_new.js) | JavaScript | 47 | 0 | 11 | 58 |
| [backend/utilities/sanitize.js](/backend/utilities/sanitize.js) | JavaScript | 15 | 0 | 1 | 16 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-11-30T01-08-04-880Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-11-30T01-08-04-880Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-11-30T01-19-41-066Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-11-30T01-19-41-066Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-11-30T05-26-05-293Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-11-30T05-26-05-293Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-11-30T19-26-34-553Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-11-30T19-26-34-553Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-11-30T21-10-02-194Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-11-30T21-10-02-194Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-12-01T03-50-42-714Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-12-01T03-50-42-714Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-12-02T18-12-30-315Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-12-02T18-12-30-315Z.json) | JSON | 1 | 0 | 0 | 1 |
| [backend/writeFailures/userInteractions\_eve\_stats\_non-retriable\_0\_2025-12-02T18-12-37-314Z.json](/backend/writeFailures/userInteractions_eve_stats_non-retriable_0_2025-12-02T18-12-37-314Z.json) | JSON | 1 | 0 | 0 | 1 |
| [frontend/helpers.jsx](/frontend/helpers.jsx) | JavaScript JSX | 29 | 13 | 7 | 49 |
| [frontend/sources.jsx](/frontend/sources.jsx) | JavaScript JSX | 201 | 1 | 2 | 204 |
| [frontend/src/App.jsx](/frontend/src/App.jsx) | JavaScript JSX | 15 | -4 | -3 | 8 |
| [frontend/src/comp/Basics.jsx](/frontend/src/comp/Basics.jsx) | JavaScript JSX | -31 | -1 | -1 | -33 |
| [frontend/src/comp/BsDynamic.jsx](/frontend/src/comp/BsDynamic.jsx) | JavaScript JSX | 2 | 0 | 0 | 2 |
| [frontend/src/comp/CatFilter.jsx](/frontend/src/comp/CatFilter.jsx) | JavaScript JSX | 6 | 0 | 0 | 6 |
| [frontend/src/comp/ChatSetup.jsx](/frontend/src/comp/ChatSetup.jsx) | JavaScript JSX | -83 | 73 | 12 | 2 |
| [frontend/src/comp/ChatsList.jsx](/frontend/src/comp/ChatsList.jsx) | JavaScript JSX | 0 | 0 | -1 | -1 |
| [frontend/src/comp/Comment.jsx](/frontend/src/comp/Comment.jsx) | JavaScript JSX | 15 | 3 | 1 | 19 |
| [frontend/src/comp/Content.jsx](/frontend/src/comp/Content.jsx) | JavaScript JSX | 2 | 4 | -1 | 5 |
| [frontend/src/comp/ContentIndis.jsx](/frontend/src/comp/ContentIndis.jsx) | JavaScript JSX | -1 | 1 | 0 | 0 |
| [frontend/src/comp/DateTimePicker.jsx](/frontend/src/comp/DateTimePicker.jsx) | JavaScript JSX | 4 | 0 | 0 | 4 |
| [frontend/src/comp/Discussion.jsx](/frontend/src/comp/Discussion.jsx) | JavaScript JSX | 32 | 6 | 3 | 41 |
| [frontend/src/comp/EntranceForm.jsx](/frontend/src/comp/EntranceForm.jsx) | JavaScript JSX | 39 | 5 | 6 | 50 |
| [frontend/src/comp/ErrorPage.jsx](/frontend/src/comp/ErrorPage.jsx) | JavaScript JSX | 202 | 0 | 15 | 217 |
| [frontend/src/comp/EventCard.jsx](/frontend/src/comp/EventCard.jsx) | JavaScript JSX | 112 | 26 | 5 | 143 |
| [frontend/src/comp/Filter.jsx](/frontend/src/comp/Filter.jsx) | JavaScript JSX | 4 | 1 | 0 | 5 |
| [frontend/src/comp/GenderAge.jsx](/frontend/src/comp/GenderAge.jsx) | JavaScript JSX | -1 | 0 | -1 | -2 |
| [frontend/src/comp/Groups.jsx](/frontend/src/comp/Groups.jsx) | JavaScript JSX | -168 | 0 | 1 | -167 |
| [frontend/src/comp/ImageCropper.jsx](/frontend/src/comp/ImageCropper.jsx) | JavaScript JSX | -14 | -1 | -1 | -16 |
| [frontend/src/comp/IntersPrivsButtons.jsx](/frontend/src/comp/IntersPrivsButtons.jsx) | JavaScript JSX | 4 | 0 | 0 | 4 |
| [frontend/src/comp/Invitations.jsx](/frontend/src/comp/Invitations.jsx) | JavaScript JSX | 1 | 0 | 0 | 1 |
| [frontend/src/comp/LocationPicker.jsx](/frontend/src/comp/LocationPicker.jsx) | JavaScript JSX | 2 | 0 | 0 | 2 |
| [frontend/src/comp/LogoAndMenu.jsx](/frontend/src/comp/LogoAndMenu.jsx) | JavaScript JSX | 1 | 9 | 0 | 10 |
| [frontend/src/comp/Map.jsx](/frontend/src/comp/Map.jsx) | JavaScript JSX | 0 | -1 | -2 | -3 |
| [frontend/src/comp/Masonry.jsx](/frontend/src/comp/Masonry.jsx) | JavaScript JSX | 1 | -1 | -1 | -1 |
| [frontend/src/comp/MenuStrip.jsx](/frontend/src/comp/MenuStrip.jsx) | JavaScript JSX | 36 | 2 | 0 | 38 |
| [frontend/src/comp/OpenedChat.jsx](/frontend/src/comp/OpenedChat.jsx) | JavaScript JSX | 33 | 0 | 11 | 44 |
| [frontend/src/comp/QuickFriendly.jsx](/frontend/src/comp/QuickFriendly.jsx) | JavaScript JSX | -1 | 0 | 0 | -1 |
| [frontend/src/comp/RateAwards.jsx](/frontend/src/comp/RateAwards.jsx) | JavaScript JSX | 2 | 5 | -1 | 6 |
| [frontend/src/comp/Sherlock.jsx](/frontend/src/comp/Sherlock.jsx) | JavaScript JSX | -1 | 0 | -1 | -2 |
| [frontend/src/comp/SimpleProtocol.jsx](/frontend/src/comp/SimpleProtocol.jsx) | JavaScript JSX | 3 | 1 | 0 | 4 |
| [frontend/src/comp/TextArea.jsx](/frontend/src/comp/TextArea.jsx) | JavaScript JSX | 3 | 0 | 0 | 3 |
| [frontend/src/comp/UserCard.jsx](/frontend/src/comp/UserCard.jsx) | JavaScript JSX | 16 | 1 | 1 | 18 |
| [frontend/src/comp/bottomMenu/Alerts.jsx](/frontend/src/comp/bottomMenu/Alerts.jsx) | JavaScript JSX | 0 | 1 | 0 | 1 |
| [frontend/src/comp/bottomMenu/Chats/Chat.jsx](/frontend/src/comp/bottomMenu/Chats/Chat.jsx) | JavaScript JSX | 39 | 3 | 4 | 46 |
| [frontend/src/comp/bottomMenu/Chats/chatSetupLogic.js](/frontend/src/comp/bottomMenu/Chats/chatSetupLogic.js) | JavaScript | 4 | 2 | -4 | 2 |
| [frontend/src/comp/bottomMenu/Chats/quickActions.js](/frontend/src/comp/bottomMenu/Chats/quickActions.js) | JavaScript | 3 | 0 | 1 | 4 |
| [frontend/src/comp/bottomMenu/Chats/useChat.js](/frontend/src/comp/bottomMenu/Chats/useChat.js) | JavaScript | 35 | 11 | 4 | 50 |
| [frontend/src/comp/bottomMenu/Gallery/index.jsx](/frontend/src/comp/bottomMenu/Gallery/index.jsx) | JavaScript JSX | 1 | -1 | -2 | -2 |
| [frontend/src/comp/bottomMenu/Menu.jsx](/frontend/src/comp/bottomMenu/Menu.jsx) | JavaScript JSX | 3 | 1 | 0 | 4 |
| [frontend/src/comp/bottomMenu/Search.jsx](/frontend/src/comp/bottomMenu/Search.jsx) | JavaScript JSX | 0 | 1 | 0 | 1 |
| [frontend/src/comp/contentStrips/ChatStrip.jsx](/frontend/src/comp/contentStrips/ChatStrip.jsx) | JavaScript JSX | 3 | 1 | 1 | 5 |
| [frontend/src/comp/contentStrips/EventStrip.jsx](/frontend/src/comp/contentStrips/EventStrip.jsx) | JavaScript JSX | 1 | 0 | 1 | 2 |
| [frontend/src/comp/contentStrips/MessageStrip.jsx](/frontend/src/comp/contentStrips/MessageStrip.jsx) | JavaScript JSX | 3 | 0 | 0 | 3 |
| [frontend/src/comp/contentStrips/UserStrip.jsx](/frontend/src/comp/contentStrips/UserStrip.jsx) | JavaScript JSX | 20 | 2 | 0 | 22 |
| [frontend/src/comp/menuStrips/ChatsListMenuStrip.jsx](/frontend/src/comp/menuStrips/ChatsListMenuStrip.jsx) | JavaScript JSX | 0 | 6 | 0 | 6 |
| [frontend/src/comp/menuStrips/EveMenuStrip.jsx](/frontend/src/comp/menuStrips/EveMenuStrip.jsx) | JavaScript JSX | 10 | 0 | 0 | 10 |
| [frontend/src/comp/menuStrips/MessMenuStrip.jsx](/frontend/src/comp/menuStrips/MessMenuStrip.jsx) | JavaScript JSX | -1 | 0 | -1 | -2 |
| [frontend/src/comp/menuStrips/UserMenuStrip.jsx](/frontend/src/comp/menuStrips/UserMenuStrip.jsx) | JavaScript JSX | 2 | 0 | 0 | 2 |
| [frontend/src/comp/menuStrips/stripButtonsJSX.jsx](/frontend/src/comp/menuStrips/stripButtonsJSX.jsx) | JavaScript JSX | 1 | 0 | 0 | 1 |
| [frontend/src/css/VisualClasses.css](/frontend/src/css/VisualClasses.css) | CSS | 10 | 0 | 2 | 12 |
| [frontend/src/hooks/socketIO/README.md](/frontend/src/hooks/socketIO/README.md) | Markdown | 0 | 0 | 20 | 20 |
| [frontend/src/hooks/socketIO/alertsHandlers.js](/frontend/src/hooks/socketIO/alertsHandlers.js) | JavaScript | 13 | 5 | 2 | 20 |
| [frontend/src/hooks/socketIO/chatsHandlers.js](/frontend/src/hooks/socketIO/chatsHandlers.js) | JavaScript | 66 | 6 | 12 | 84 |
| [frontend/src/hooks/socketIO/socketHandlers.js](/frontend/src/hooks/socketIO/socketHandlers.js) | JavaScript | -116 | 21 | -9 | -104 |
| [frontend/src/hooks/socketIO/transport.js](/frontend/src/hooks/socketIO/transport.js) | JavaScript | -376 | 18 | -36 | -394 |
| [frontend/src/hooks/useCommentsMan.js](/frontend/src/hooks/useCommentsMan.js) | JavaScript | 3 | 0 | 0 | 3 |
| [frontend/src/hooks/useErrorsMan.js](/frontend/src/hooks/useErrorsMan.js) | JavaScript | 1 | 0 | 0 | 1 |
| [frontend/src/hooks/useToast.jsx](/frontend/src/hooks/useToast.jsx) | JavaScript JSX | 1 | 0 | 0 | 1 |
| [frontend/src/loaders/editorLoader.js](/frontend/src/loaders/editorLoader.js) | JavaScript | 4 | 0 | 0 | 4 |
| [frontend/src/loaders/eventLoader.js](/frontend/src/loaders/eventLoader.js) | JavaScript | -1 | 0 | -1 | -2 |
| [frontend/src/loaders/foundationLoader.js](/frontend/src/loaders/foundationLoader.js) | JavaScript | 44 | 6 | 4 | 54 |
| [frontend/src/loaders/setupLoader.js](/frontend/src/loaders/setupLoader.js) | JavaScript | -1 | 0 | -1 | -2 |
| [frontend/src/mainSections/Event.jsx](/frontend/src/mainSections/Event.jsx) | JavaScript JSX | -3 | 0 | 0 | -3 |
| [frontend/src/mainSections/Foundation.jsx](/frontend/src/mainSections/Foundation.jsx) | JavaScript JSX | 15 | 0 | 1 | 16 |
| [frontend/src/mainSections/Home.jsx](/frontend/src/mainSections/Home.jsx) | JavaScript JSX | 3 | 2 | 1 | 6 |
| [frontend/src/utils/locationUtils.js](/frontend/src/utils/locationUtils.js) | JavaScript | -1 | 0 | -1 | -2 |
| [frontend/src/utils/userProfileUtils.js](/frontend/src/utils/userProfileUtils.js) | JavaScript | 1 | 0 | 1 | 2 |
| [frontend/workers/forageSetWorker.js](/frontend/workers/forageSetWorker.js) | JavaScript | 109 | 21 | 17 | 147 |
| [scripts/docker-clean.js](/scripts/docker-clean.js) | JavaScript | 12 | 1 | 0 | 13 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details