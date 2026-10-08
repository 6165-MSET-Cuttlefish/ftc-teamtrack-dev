import {
  collection,
  getDocs,
  getDocsFromServer,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  type WriteBatch,
  query,
  where,
  Timestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  type DocumentSnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase, isAbortError } from '@/lib';
import type {
  Team,
  CreateTeamData,
  JoinedTeam,
  LeaveOutcome,
  TeamInvite,
  TeamMember,
} from '@/types';

/**
 * How many leading `members` slots the Firestore rules can inspect when a
 * legacy team has no `ownerId` (rules cannot loop). Keep in step with
 * `isLegacyOwner` in firestore.rules.
 */
const LEGACY_OWNER_SLOTS = 10;

/** Longest display name the rules accept in a member entry. */
const MAX_MEMBER_NAME_LENGTH = 50;

/** How long to wait for the team to be read back after joining it. */
const JOIN_READ_TIMEOUT_MS = 4000;

/**
 * How far outside its sign-in token's lifetime the device clock may read
 * before it is taken to be wrong.
 */
const CLOCK_SLACK_MS = 5 * 60 * 1000;

/**
 * Sessions of other members taken out of a team per write when it is
 * deleted. The rules read the team for each, and a write may make 20 such
 * reads in all.
 */
const UNFILE_BATCH = 10;

/** A stored `teamInvites` document. `revoked` marks a retired code. */
interface StoredInvite {
  teamId: string | null;
  teamName: string;
  revoked: boolean;
}

const isPermissionDenied = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === 'permission-denied';

/**
 * Teams, and how the Firestore rules police them (see firestore.rules):
 *
 * - The owner is `ownerId`, and must still be a member. Only the owner can
 *   rename, kick, transfer, or change the invite code — and even the owner
 *   cannot add members. `members[].role` mirrors it for display. On teams
 *   saved before `ownerId` existed the role is the record, see `ownerOf`.
 * - A member can only remove themselves, or change their own display name.
 * - A non-member can only add themselves, and only by writing the team's
 *   current invite code together with their own uid into `joinCode` — so
 *   knowing a team's ID is not enough to get in, and removing a member
 *   (which changes the code) keeps them out.
 * - Invite codes resolve through `teamInvites/{code}` → `{ teamId, teamName }`,
 *   which any signed-in user can fetch by exact code but nobody can list.
 *   A code belongs to one team: the team document and its invite are always
 *   written together, in one batch. Team documents themselves are readable
 *   by members only.
 * - A code a team stops using is retired, never freed: its invite stays,
 *   marked `revoked`, so no other team can take the code over and with it
 *   every copy of the old link. See `retireInvite`.
 */
class TeamService {
  private dbInstance: Firestore | null = null;

  /** Get Firestore database instance (lazy initialization) */
  private async getDB(): Promise<Firestore> {
    if (this.dbInstance) return this.dbInstance;

    const firebase = await getFirebase();
    if (!firebase?.db) {
      throw new Error('Firebase not initialized');
    }

    this.dbInstance = firebase.db;
    return this.dbInstance;
  }

  /**
   * Safely execute a database operation with abort error handling
   */
  private async safeExecute<T>(
    operation: () => Promise<T>,
    fallback: T,
    errorMessage: string,
    throwOnError = false
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isAbortError(error)) {
        return fallback;
      }
      const { logger } = await import('@/lib/logger');
      logger.error(errorMessage, error);
      if (throwOnError) {
        throw error;
      }
      return fallback;
    }
  }

  /** Generate a unique invite code */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = crypto.getRandomValues(new Uint32Array(8));
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(values[i] % chars.length);
    }
    return code;
  }

  /**
   * The team's owner: `ownerId`, as long as they are still a member.
   *
   * Teams saved before `ownerId` existed recorded ownership only in
   * `members[].role` (transfers and owner-leaves kept that up to date, while
   * `createdBy` went stale), so there the owner is the member holding the
   * 'owner' role, and the creator only when nobody holds it. This is the
   * same test the Firestore rules apply. Returns '' when the team has no
   * owner left.
   */
  ownerOf(
    team: Pick<Team, 'createdBy'> &
      Partial<Pick<Team, 'ownerId' | 'members' | 'memberIds'>>
  ): string {
    const members = team.members ?? [];
    const memberIds = team.memberIds ?? members.map((m) => m.userId);
    const owner =
      team.ownerId ??
      members.slice(0, LEGACY_OWNER_SLOTS).find((m) => m.role === 'owner')
        ?.userId ??
      team.createdBy;
    return memberIds.includes(owner) ? owner : '';
  }

  private toTeam(snapshot: DocumentSnapshot): Team {
    return { id: snapshot.id, ...snapshot.data() } as Team;
  }

  /** Point an invite code at its team. Owner only. */
  private async writeInvite(teamId: string, code: string, teamName: string) {
    const db = await this.getDB();
    await setDoc(doc(db, 'teamInvites', code), { teamId, teamName });
  }

  /** The invite stored for a code, live or retired; null if there is none. */
  private async readInvite(db: Firestore, code: string): Promise<StoredInvite | null> {
    const invite = await getDoc(doc(db, 'teamInvites', code));
    if (!invite.exists()) return null;
    const data = invite.data();
    return {
      teamId: data.teamId ?? null,
      teamName: data.teamName ?? '',
      revoked: data.revoked === true,
    };
  }

  /**
   * An invite code no team is using or has used (the rules reject a taken
   * one, and a retired one).
   */
  private async unusedInviteCode(db: Firestore): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateInviteCode();
      if ((await this.readInvite(db, code)) === null) return code;
    }
    throw new Error('Could not generate an invite code');
  }

  /**
   * Retire the team's current invite code, as part of `batch`. The invite
   * is kept, marked revoked and still naming the team, rather than deleted:
   * a deleted one frees the code, and whoever claimed it next would own
   * every copy of the old link. `current` is what the code resolves to now.
   * Another team's invite is not ours to write (it would fail the batch).
   */
  private retireInvite(
    batch: WriteBatch,
    db: Firestore,
    team: Team,
    current: StoredInvite | null
  ) {
    if (current && current.teamId !== team.id) return;
    batch.set(doc(db, 'teamInvites', team.inviteCode), {
      teamId: team.id,
      teamName: team.name,
      revoked: true,
    });
  }

  /**
   * Give a team a new invite code. The team document, the new invite and
   * the retiring of the old one go in a single batch: either the old link
   * stops and the new one works, or nothing changed. `teamChanges` are
   * written to the team in the same batch.
   */
  private async rotateInviteCode(
    db: Firestore,
    team: Team,
    teamChanges: Record<string, unknown> = {}
  ): Promise<string> {
    const newCode = await this.unusedInviteCode(db);
    const oldInvite = await this.readInvite(db, team.inviteCode);

    const batch = writeBatch(db);
    batch.update(doc(db, 'teams', team.id), {
      ...teamChanges,
      inviteCode: newCode,
      // Proof left by earlier joins; meaningless once the code changes.
      joinCode: deleteField(),
    });
    batch.set(doc(db, 'teamInvites', newCode), {
      teamId: team.id,
      teamName: team.name,
    });
    this.retireInvite(batch, db, team, oldInvite);
    await batch.commit();
    return newCode;
  }

  /**
   * Bring an owner's team up to date with the current data model: record
   * `ownerId`, and make sure its invite code resolves. Teams created before
   * `teamInvites` existed have no invite document, which is why their links
   * stopped working. Safe to call on every load; a no-op for non-owners.
   */
  async ensureOwnerSetup(team: Team, userId: string): Promise<void> {
    if (this.ownerOf(team) !== userId) return;
    try {
      const db = await this.getDB();
      if (!team.ownerId) {
        await updateDoc(doc(db, 'teams', team.id), { ownerId: userId });
      }
      const invite = await this.readInvite(db, team.inviteCode);
      if (invite && (invite.teamId !== team.id || invite.revoked)) {
        // The code resolves to another team, or has been retired, and an
        // invite can never be re-pointed or revived. Take a fresh code so
        // this team's link works again.
        await this.rotateInviteCode(db, team, { ownerId: userId });
      } else if (!invite || invite.teamName !== team.name) {
        await this.writeInvite(team.id, team.inviteCode, team.name);
      }
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.warn('Could not update team setup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Create a new team */
  async createTeam(teamData: CreateTeamData): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const inviteCode = await this.unusedInviteCode(db);

        const newTeam = {
          name: teamData.name,
          createdBy: teamData.createdBy,
          ownerId: teamData.createdBy,
          createdAt: Timestamp.now(),
          inviteCode,
          memberIds: [teamData.createdBy],
          members: [
            {
              userId: teamData.createdBy,
              email: teamData.createdByEmail,
              displayName: teamData.createdByName || '',
              joinedAt: Timestamp.now(),
              role: 'owner' as const,
            },
          ],
        };

        // The ID is chosen up front so the team and its invite can be
        // written together: a team never exists without a working link.
        const docRef = doc(collection(db, 'teams'));
        const batch = writeBatch(db);
        batch.set(docRef, newTeam);
        batch.set(doc(db, 'teamInvites', inviteCode), {
          teamId: docRef.id,
          teamName: newTeam.name,
        });
        await batch.commit();
        return { id: docRef.id, ...newTeam } as Team;
      },
      null,
      'Error creating team:',
      true
    );
  }

  /** Get team by ID (members only) */
  async getTeam(teamId: string): Promise<Team | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        return this.toTeam(docSnap);
      },
      null,
      'Error fetching team:'
    );
  }

  /**
   * Read a team the user is expected to be in. Resolves to the team, or to
   * null when the user is not in it any more (removed, left on another
   * device, or the team was deleted). Throws when the read itself failed, so
   * a dropped connection is never mistaken for losing the team.
   */
  async getMembership(teamId: string, userId: string): Promise<Team | null> {
    const db = await this.getDB();
    try {
      const snapshot = await getDoc(doc(db, 'teams', teamId));
      if (!snapshot.exists()) return null;
      const team = this.toTeam(snapshot);
      return (team.memberIds ?? []).includes(userId) ? team : null;
    } catch (error) {
      // Team documents are members-only: a denied read means "not a member".
      if (isPermissionDenied(error)) return null;
      throw error;
    }
  }

  /**
   * Watch a team the user is in. `onChange` gets the team each time it
   * changes, and null once the user is no longer in it (removed, left
   * elsewhere, or the team was deleted). Returns the unsubscribe function.
   */
  async subscribeToTeam(
    teamId: string,
    userId: string,
    onChange: (team: Team | null) => void
  ): Promise<Unsubscribe> {
    const db = await this.getDB();
    return onSnapshot(
      doc(db, 'teams', teamId),
      (snapshot) => {
        if (!snapshot.exists()) {
          // Nothing cached yet is not the same as deleted.
          if (!snapshot.metadata.fromCache) onChange(null);
          return;
        }
        const team = this.toTeam(snapshot);
        onChange((team.memberIds ?? []).includes(userId) ? team : null);
      },
      async (error) => {
        const { logger } = await import('@/lib/logger');
        if (!isPermissionDenied(error)) {
          logger.error('Error in team listener', error);
          return;
        }
        // Signing out also cuts the listener off; that is not a removal.
        const firebase = await getFirebase();
        if (firebase?.auth.currentUser?.uid === userId) onChange(null);
      }
    );
  }

  /**
   * Look up which team an invite code belongs to. A retired code (replaced,
   * or its team deleted) is as invalid as one that never existed.
   */
  async getInviteByCode(inviteCode: string): Promise<TeamInvite | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const code = inviteCode.trim().toUpperCase();
        if (!code) return null;
        const invite = await this.readInvite(db, code);
        if (!invite || invite.revoked || !invite.teamId) return null;
        return { code, teamId: invite.teamId, teamName: invite.teamName };
      },
      null,
      'Error fetching team by invite code:'
    );
  }

  /**
   * Get all teams for a user.
   *
   * By default a failed lookup reads as "no teams". Pass `strict` to ask the
   * server directly and throw instead, for callers that must not mistake
   * being offline for not being in a team.
   */
  async getUserTeams(userId: string, strict = false): Promise<Team[]> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();

        const memberQuery = query(
          collection(db, 'teams'),
          where('memberIds', 'array-contains', userId)
        );
        const snapshot = strict
          ? await getDocsFromServer(memberQuery)
          : await getDocs(memberQuery);

        return snapshot.docs.map((teamDoc) => this.toTeam(teamDoc));
      },
      [],
      'Error fetching user teams:',
      strict
    );
  }

  /**
   * The two things the rules hold a new member entry to: the signed-in
   * account's email, and a `joinedAt` within a day of the server's clock.
   *
   * The device clock is normally that time. But a device whose clock is days
   * out would be turned away, so it is checked against the sign-in token,
   * which carries the server's time of issue and lasts an hour: a clock
   * reading outside the token's lifetime is wrong, and the time a fresh
   * token was issued (just now, by the server) is used instead.
   */
  private async joinProof(
    fallbackEmail: string
  ): Promise<Pick<TeamMember, 'email'> & { joinedAt: Timestamp }> {
    try {
      const firebase = await getFirebase();
      const user = firebase?.auth.currentUser;
      if (!user) return { email: fallbackEmail, joinedAt: Timestamp.now() };

      const token = await user.getIdTokenResult();
      const claim = token.claims.email;
      const email = typeof claim === 'string' ? claim : fallbackEmail;

      const now = Date.now();
      const issued = Date.parse(token.issuedAtTime);
      const expires = Date.parse(token.expirationTime);
      if (now >= issued - CLOCK_SLACK_MS && now <= expires + CLOCK_SLACK_MS) {
        return { email, joinedAt: Timestamp.now() };
      }

      // If it can't be refreshed, the token in hand is at most an hour old.
      const fresh = await user.getIdTokenResult(true).catch(() => token);
      const serverTime = Date.parse(fresh.issuedAtTime);
      return {
        email,
        joinedAt: Number.isFinite(serverTime)
          ? Timestamp.fromMillis(serverTime)
          : Timestamp.now(),
      };
    } catch {
      return { email: fallbackEmail, joinedAt: Timestamp.now() };
    }
  }

  /** Read a team that was just joined; null if it can't be loaded right now. */
  private async readJoinedTeam(db: Firestore, teamId: string): Promise<Team | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const snapshot = await Promise.race([
          getDoc(doc(db, 'teams', teamId)),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Timed out reading team')),
              JOIN_READ_TIMEOUT_MS
            )
          ),
        ]);
        if (snapshot.exists()) return this.toTeam(snapshot);
      } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.warn('Could not read team after joining', {
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return null;
  }

  /**
   * Join a team using invite code. Throws if the code is invalid or the
   * join is rejected. Once the join is written the result is always a team:
   * if it can't be read back, `loaded` is false and the team is built from
   * the invite, rather than reporting a join that happened as a failure.
   */
  async joinTeam(
    inviteCode: string,
    userId: string,
    userEmail: string,
    displayName?: string
  ): Promise<JoinedTeam | null> {
    return this.safeExecute(
      async () => {
        const invite = await this.getInviteByCode(inviteCode);
        if (!invite) {
          throw new Error('Invalid invite code');
        }

        const db = await this.getDB();
        const teamRef = doc(db, 'teams', invite.teamId);

        // Team documents are members-only, so a successful read means the
        // user is already in this team; a denied read is the normal case.
        const currentMembership = async (): Promise<Team | null> => {
          try {
            const snap = await getDoc(teamRef);
            if (snap.exists() && (snap.data().memberIds ?? []).includes(userId)) {
              return this.toTeam(snap);
            }
          } catch {
            // Not a member
          }
          return null;
        };

        const existing = await currentMembership();
        if (existing) return { team: existing, loaded: true };

        // The rules check every field of this entry: the email is the
        // signed-in account's, and joinedAt is close to the server's clock.
        const { email, joinedAt } = await this.joinProof(userEmail);
        const newMember: TeamMember = {
          userId,
          email,
          displayName: (displayName || '').slice(0, MAX_MEMBER_NAME_LENGTH),
          joinedAt,
          role: 'member',
        };

        try {
          await updateDoc(teamRef, {
            members: arrayUnion(newMember),
            memberIds: arrayUnion(userId),
            // Proof of invite: the rules only admit a new member whose
            // joinCode is the team's current invite code plus their own
            // uid, so one member's proof never admits anyone else.
            joinCode: `${invite.code}:${userId}`,
          });
        } catch (error) {
          // A write that reached the server but lost its reply is retried
          // and then rejected ("already a member"). Check before giving up.
          const joined = await currentMembership();
          if (joined) return { team: joined, loaded: true };
          throw error;
        }

        const team = await this.readJoinedTeam(db, invite.teamId);
        if (team) return { team, loaded: true };

        return {
          team: {
            id: invite.teamId,
            name: invite.teamName,
            createdBy: '',
            createdAt: newMember.joinedAt,
            inviteCode: invite.code,
            members: [newMember],
            memberIds: [userId],
          },
          loaded: false,
        };
      },
      null,
      'Error joining team:',
      true
    );
  }

  /** Update team name (owner only) */
  async updateTeamName(teamId: string, name: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const team = this.toTeam(teamDoc);
        const owner = this.ownerOf(team);
        // The invite carries the name shown on the join page, so both
        // change together. An invite that points at another team, or has
        // been retired, is not ours to write (ensureOwnerSetup replaces the
        // code on next load).
        const invite = await this.readInvite(db, team.inviteCode);

        const batch = writeBatch(db);
        batch.update(docRef, { name, ...(owner ? { ownerId: owner } : {}) });
        if (!invite || (invite.teamId === teamId && !invite.revoked)) {
          batch.set(doc(db, 'teamInvites', team.inviteCode), {
            teamId,
            teamName: name,
          });
        }
        await batch.commit();
        return true;
      },
      false,
      'Error updating team name:',
      true
    );
  }

  /** Regenerate invite code (owner only). Old links stop working. */
  async regenerateInviteCode(teamId: string): Promise<string | null> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const teamDoc = await getDoc(doc(db, 'teams', teamId));
        if (!teamDoc.exists()) return null;

        const team = this.toTeam(teamDoc);
        const owner = this.ownerOf(team);
        return this.rotateInviteCode(
          db,
          team,
          owner ? { ownerId: owner } : {}
        );
      },
      null,
      'Error regenerating invite code:',
      true
    );
  }

  /** Serialize a Firestore member object into a clean plain object */
  private cleanMember(m: TeamMember, roleOverride?: 'owner' | 'member'): Record<string, unknown> {
    return {
      userId: m.userId,
      email: m.email,
      displayName: m.displayName || '',
      joinedAt: m.joinedAt,
      role: roleOverride ?? m.role,
    };
  }

  /**
   * What `userId` leaving `team` would do, so the UI can say it before they
   * confirm: a member just goes, the owner hands the team to its
   * longest-standing member, and the last member takes the team with them.
   * `leaveTeam` acts on the same answer.
   */
  leaveOutcome(
    team: Pick<Team, 'createdBy'> &
      Partial<Pick<Team, 'ownerId' | 'members' | 'memberIds'>>,
    userId: string
  ): LeaveOutcome {
    if (this.ownerOf(team) !== userId) return { kind: 'left' };

    const remaining = (team.members ?? []).filter((m) => m.userId !== userId);
    if (remaining.length === 0) return { kind: 'deleted' };

    const joinedSeconds = (m: TeamMember) =>
      m.joinedAt && typeof m.joinedAt === 'object' && 'seconds' in m.joinedAt
        ? (m.joinedAt as { seconds: number }).seconds
        : 0;
    return {
      kind: 'handed-over',
      newOwner: [...remaining].sort(
        (a, b) => joinedSeconds(a) - joinedSeconds(b)
      )[0],
    };
  }

  /**
   * Take every session filed under `teamId` out of it, for its owner
   * (`userId`) to delete it. Their own sessions go in `batch`, with the
   * delete. Members who left earlier have sessions there too, which only
   * the owner can take out, and only while the team exists: those go
   * first, a few to a write, since the rules read the team for each one.
   */
  private async unfileTeamSessions(
    db: Firestore,
    teamId: string,
    userId: string,
    batch: WriteBatch
  ): Promise<void> {
    const filed = await getDocsFromServer(
      query(collection(db, 'sessions'), where('teamId', '==', teamId))
    );
    const unfile = { teamId: deleteField() };
    const others = filed.docs.filter(s => s.data().userId !== userId);
    for (let start = 0; start < others.length; start += UNFILE_BATCH) {
      const earlier = writeBatch(db);
      others
        .slice(start, start + UNFILE_BATCH)
        .forEach(s => earlier.update(s.ref, unfile));
      await earlier.commit();
    }
    filed.docs
      .filter(s => s.data().userId === userId)
      .forEach(s => batch.update(s.ref, unfile));
  }

  /**
   * Leave a team. A member just removes themselves. The owner hands the team
   * to the longest-standing member, or deletes it if they were the last one.
   * Resolves to what happened (see `leaveOutcome`), or null if the team could
   * not be found.
   */
  async leaveTeam(teamId: string, userId: string): Promise<LeaveOutcome | null> {
    return this.safeExecute<LeaveOutcome | null>(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return null;

        const team = this.toTeam(teamDoc);
        const members: TeamMember[] = team.members || [];
        const leavingMember = members.find((m) => m.userId === userId);
        if (!leavingMember) return { kind: 'left' };
        const remaining = members.filter((m) => m.userId !== userId);
        const outcome = this.leaveOutcome(team, userId);

        if (outcome.kind === 'left') {
          // Remove exactly the stored entry, so the rules can see nothing
          // else in the member list changed.
          await updateDoc(docRef, {
            members: arrayRemove(leavingMember),
            memberIds: arrayRemove(userId),
          });
          return outcome;
        }

        if (outcome.kind === 'deleted') {
          // The team and its invite go together, so no live link is left
          // pointing at a team that no longer exists. So do its sessions:
          // they go back to whoever recorded them. Left filed under a team
          // that is gone, nobody could ever change or share them again.
          const invite = await this.readInvite(db, team.inviteCode);
          const batch = writeBatch(db);
          await this.unfileTeamSessions(db, teamId, userId, batch);
          this.retireInvite(batch, db, team, invite);
          batch.delete(docRef);
          await batch.commit();
          return outcome;
        }

        const newOwnerUserId = outcome.newOwner.userId;
        await updateDoc(docRef, {
          ownerId: newOwnerUserId,
          members: remaining.map((m) =>
            this.cleanMember(m, m.userId === newOwnerUserId ? 'owner' : 'member')
          ),
          memberIds: remaining.map((m) => m.userId),
        });
        return outcome;
      },
      null,
      'Error leaving team:',
      true
    );
  }

  /** Transfer ownership to another member (owner only) */
  async transferOwnership(teamId: string, currentOwnerId: string, newOwnerId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const team = this.toTeam(teamDoc);
        const members: TeamMember[] = team.members || [];

        if (this.ownerOf(team) !== currentOwnerId) return false;
        if (!members.some((m) => m.userId === newOwnerId)) return false;

        const updatedMembers = members.map((m) => {
          if (m.userId === currentOwnerId) return this.cleanMember(m, 'member');
          if (m.userId === newOwnerId) return this.cleanMember(m, 'owner');
          return this.cleanMember(m);
        });

        await updateDoc(docRef, {
          ownerId: newOwnerId,
          members: updatedMembers,
        });
        return true;
      },
      false,
      'Error transferring ownership:',
      true
    );
  }

  /**
   * Kick a member from the team (owner only). The invite code changes in
   * the same write: every member has seen the old one, so leaving it valid
   * would let the removed member straight back in.
   */
  async kickMember(teamId: string, ownerUserId: string, targetUserId: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const team = this.toTeam(teamDoc);
        const members: TeamMember[] = team.members || [];

        if (this.ownerOf(team) !== ownerUserId) return false;
        if (ownerUserId === targetUserId) return false;

        const remaining = members.filter((m) => m.userId !== targetUserId);

        await this.rotateInviteCode(db, team, {
          ownerId: ownerUserId,
          members: remaining.map((m) => this.cleanMember(m)),
          memberIds: remaining.map((m) => m.userId),
        });
        return true;
      },
      false,
      'Error kicking member:',
      true
    );
  }

  /** Update the current user's own display name in the team */
  async updateMemberDisplayName(teamId: string, userId: string, newDisplayName: string): Promise<boolean> {
    return this.safeExecute(
      async () => {
        const db = await this.getDB();
        const docRef = doc(db, 'teams', teamId);
        const teamDoc = await getDoc(docRef);
        if (!teamDoc.exists()) return false;

        const members: TeamMember[] = teamDoc.data().members || [];
        const displayName = newDisplayName.slice(0, MAX_MEMBER_NAME_LENGTH);

        // Every other entry is written back untouched: the rules let a
        // member change their own display name and nothing else.
        await updateDoc(docRef, {
          members: members.map((m) =>
            m.userId === userId ? { ...m, displayName } : m
          ),
        });
        return true;
      },
      false,
      'Error updating member display name:',
      true
    );
  }
}

export const teamService = new TeamService();
