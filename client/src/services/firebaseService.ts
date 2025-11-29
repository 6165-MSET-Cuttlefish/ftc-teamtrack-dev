import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import getFirebase from '../lib/firebase';
import { Session } from '../types/session';

export type SessionData = Session;

class FirebaseService {
  private async getDB() {
    const firebase = await getFirebase();
    if (!firebase) {
      throw new Error('Firebase not initialized');
    }
    return firebase.db;
  }

  async createSession(
    sessionData: Omit<SessionData, 'id' | 'createdAt'>
  ): Promise<SessionData | null> {
    try {
      const db = await this.getDB();
      const newSession = {
        ...sessionData,
        createdAt: Timestamp.now(),
      };
      const docRef = await addDoc(collection(db, 'sessions'), newSession);

      return {
        id: docRef.id,
        ...newSession,
      } as SessionData;
    } catch (error: any) {
      if (error && error.name === 'AbortError') {
        return null;
      }
      console.error('Error creating session:', error);
      return null;
    }
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const db = await this.getDB();
      const q = query(
        collection(db, 'sessions'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as SessionData[];
    } catch (error: any) {
      if (error && error.name === 'AbortError') {
        // Suppress noisy AbortError from Firestore/internal fetch during HMR or navigation
        return [];
      }
      console.error('Error fetching user sessions:', error);
      return [];
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const db = await this.getDB();
      const docRef = doc(db, 'sessions', sessionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as SessionData;
      }

      return null;
    } catch (error: any) {
      if (error && error.name === 'AbortError') {
        return null;
      }
      console.error('Error fetching session:', error);
      return null;
    }
  }

  async getAllSessions(): Promise<SessionData[]> {
    try {
      const db = await this.getDB();
      const q = query(
        collection(db, 'sessions'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as SessionData[];
    } catch (error: any) {
      if (error && error.name === 'AbortError') {
        return [];
      }
      console.error('Error fetching all sessions:', error);
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const docRef = doc(db, 'sessions', sessionId);
      await deleteDoc(docRef);
      return true;
    } catch (error: any) {
      if (error && error.name === 'AbortError') {
        return false;
      }
      console.error('Error deleting session:', error);
      throw error;
    }
  }
}

export const firebaseService = new FirebaseService();
