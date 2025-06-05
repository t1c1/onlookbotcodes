import { auth, db } from '@onlook/db/firebase';

export function createClient() {
    // This function now returns the firebase auth and db instances
    return { auth, db };
} 