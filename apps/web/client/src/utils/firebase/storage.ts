import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@onlook/db/firebase';

// A helper function to get the storage instance
const getStorage = () => {
    return storage;
}

export const getFileUrlFromStorage = async (path: string) => {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
};

export const uploadBlobToStorage = async (path: string, file: Blob, options?: {
    contentType?: string;
    cacheControl?: string;
}) => {
    const storageRef = ref(storage, path);
    const metadata = {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl,
    };
    const snapshot = await uploadBytes(storageRef, file, metadata);
    return snapshot;
}; 