import { onAuthStateChanged, signOut, type User as AuthUser } from 'firebase/auth';
import { makeAutoObservable } from 'mobx';

import { auth } from '@onlook/db/firebase';
import type { UserMetadata } from '@onlook/models';
import { LanguageManager } from './language';
import { UserSettingsManager } from './settings';
import { SubscriptionManager } from './subscription';

export class UserManager {
    readonly settings: UserSettingsManager;
    readonly subscription = new SubscriptionManager();
    readonly language = new LanguageManager();
    user: UserMetadata | null = null;

    constructor() {
        makeAutoObservable(this);
        this.settings = new UserSettingsManager(this);
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = this.fromAuthUser(user);
            } else {
                this.user = null;
            }
        });
    }

    fromAuthUser(authUser: AuthUser): UserMetadata {
        return {
            id: authUser.uid,
            name: authUser.displayName ?? authUser.email ?? undefined,
            email: authUser.email ?? undefined,
            avatarUrl: authUser.photoURL ?? undefined,
        };
    }

    async signOut() {
        await signOut(auth);
        this.user = null;
    }
}
