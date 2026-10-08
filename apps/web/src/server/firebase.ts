import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { adminDb, FirestoreRepo, initAdmin } from '@/core/firestore/repo.ts';

let instance: FirestoreRepo | null = null;

/** Firestore through the Admin SDK. Only the server touches the database. */
export const db = () => adminDb();
export const repo = () => (instance ??= new FirestoreRepo(adminDb()));
export const adminAuth = () => getAuth(initAdmin());
