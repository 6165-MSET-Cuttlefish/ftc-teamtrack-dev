import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase, logger, isAbortError } from '@/lib';
import { VIDEO_LIMITS } from '@/constants';
import type { CreateVideoAnalysisData, VideoAnalysis } from '@/types';

class VideoAnalysisService {
  private dbInstance: Firestore | null = null;

  private async getDB(): Promise<Firestore> {
    if (this.dbInstance) return this.dbInstance;

    const firebase = await getFirebase();
    if (!firebase?.db) {
      throw new Error('Firebase not initialized');
    }

    this.dbInstance = firebase.db;
    return this.dbInstance;
  }

  /** Save a completed (or errored) video analysis to Firestore */
  async createVideoAnalysis(
    data: CreateVideoAnalysisData
  ): Promise<VideoAnalysis | null> {
    try {
      const db = await this.getDB();
      const clean = JSON.parse(JSON.stringify(data));
      const newDoc = { ...clean, createdAt: Timestamp.now() };
      const docRef = await addDoc(collection(db, 'videoAnalyses'), newDoc);
      return { id: docRef.id, ...newDoc } as VideoAnalysis;
    } catch (error) {
      if (isAbortError(error)) return null;
      logger.error('Error creating video analysis:', error);
      throw error;
    }
  }

  /** Subscribe to real-time video analysis updates for a team */
  async subscribeTeamVideoAnalyses(
    teamId: string,
    onUpdate: (analyses: VideoAnalysis[]) => void,
    onError?: (error: Error) => void
  ): Promise<Unsubscribe> {
    const db = await this.getDB();
    const q = query(
      collection(db, 'videoAnalyses'),
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc'),
      limit(VIDEO_LIMITS.MAX_ANALYSES_PER_TEAM)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const analyses = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as VideoAnalysis)
        );
        onUpdate(analyses);
      },
      (error) => {
        logger.error('Error in team video analyses listener', error);
        onError?.(error);
      }
    );
  }

  /** Delete a video analysis record (does not delete the underlying Cloudinary asset) */
  async deleteVideoAnalysis(analysisId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      await deleteDoc(doc(db, 'videoAnalyses', analysisId));
      return true;
    } catch (error) {
      if (isAbortError(error)) return false;
      logger.error('Error deleting video analysis:', error);
      return false;
    }
  }
}

export const videoAnalysisService = new VideoAnalysisService();
