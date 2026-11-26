import { gdb } from 'genosdb';

const db = await gdb("Secure-Chat-by-Dragoncloak9000", {rtc: true, sm: {superAdmins: [], resume: false}})
const room = db.room
if (!room || !db.sm) {
    throw new Error("LACKS A NEEDED PROPERTY 🤬🤬")
}
export default db;