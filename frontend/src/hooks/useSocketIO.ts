// SOCKET IO HOOK RE-EXPORT -----------------------------------------------------
// Steps: keep legacy import path stable, re-export the new implementation, and also re-export disconnect helper so callsites can migrate without churn.
import useSocketIO, { disconnectSocketIO } from './socketIO/socketHandlers';

export { disconnectSocketIO };
export default useSocketIO;
