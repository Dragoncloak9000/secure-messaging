import { Dexie, type EntityTable } from 'dexie';

interface Contact {
    id?: number;
    name: string;
    key: string
}

const db = new Dexie('Database') as Dexie & {
    contacts: EntityTable<Contact, 'id'>
}

db.version(1).stores({
    contacts: '++id, name, key'
})

export type { Contact }
export { db };