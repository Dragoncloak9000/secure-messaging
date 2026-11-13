import { Dexie, type EntityTable } from 'dexie';

interface Database {
    user: string;
    data: string;
    nonce: string;
}

const db = new Dexie('Database') as Dexie & {
    users: EntityTable<Database, 'user'>
}

db.version(1).stores({
    users: 'user, data, nonce'
})

export type { Database }
export { db };