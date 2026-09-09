import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';

export type GroupId = 1 | 2 | 3 | 4;
export type RedemptionStatus = 'pending' | 'approved' | 'rejected';

export type Student = {
  id: string;
  number: number;
  name: string;
  group: GroupId;
  points: number;
};

export type Transaction = {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  reason: string;
  timestamp: string;
};

export type Reward = {
  id: string;
  title: string;
  cost: number;
  icon: 'seat' | 'meal' | 'book' | 'game';
};

export type Redemption = {
  id: string;
  studentId: string;
  studentName: string;
  rewardId: string;
  rewardTitle: string;
  cost: number;
  status: RedemptionStatus;
  requestedAt: string;
};

export type ClassroomState = {
  students: Student[];
  transactions: Transaction[];
  rewards: Reward[];
  redemptions: Redemption[];
};

const STORAGE_KEY = 'class-points:classroom:v2';
const EVENT_NAME = 'class-points:state-change';
const COLLECTIONS = {
  students: 'Students',
  transactions: 'Transactions',
  rewards: 'Rewards',
  redemptions: 'Redemptions',
} as const;

const seedNames = [
  '김민준', '이서윤', '박도윤', '최지우', '정하은', '강준서',
  '윤서아', '임시우', '한유진', '오지호', '서수빈', '배건우',
  '문채원', '신현우', '권나은', '황도현', '송예린', '조우진',
  '전다은', '홍서준', '양지민', '고은찬', '류하린', '안준혁',
];

const seedStudents: Student[] = seedNames.map((name, index) => ({
  id: `student-${index + 1}`,
  number: index + 1,
  name,
  group: ((index % 4) + 1) as GroupId,
  points: 0,
}));

const seedRewards: Reward[] = [
  { id: 'reward-seat', title: '자리 바꾸기권', cost: 50, icon: 'seat' },
  { id: 'reward-meal', title: '급식 1등권', cost: 30, icon: 'meal' },
  { id: 'reward-homework', title: '숙제 1회 면제권', cost: 40, icon: 'book' },
  { id: 'reward-game', title: '선생님과 보드게임권', cost: 100, icon: 'game' },
];

function cloneSeed(): ClassroomState {
  return {
    students: seedStudents.map((student) => ({ ...student })),
    transactions: [],
    rewards: seedRewards.map((reward) => ({ ...reward })),
    redemptions: [],
  };
}

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function loadLocalState(): ClassroomState {
  if (!hasWindow()) return cloneSeed();
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneSeed();
    const parsed = JSON.parse(saved) as ClassroomState;
    return parsed.students && parsed.transactions && parsed.rewards && parsed.redemptions
      ? parsed
      : cloneSeed();
  } catch {
    return cloneSeed();
  }
}

function getFirebaseConfig(): Record<string, string> | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (raw) {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return null;
    }
  }
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    projectId,
    appId,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
const firebaseConfig = getFirebaseConfig();
if (firebaseConfig) {
  firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
  firestore = getFirestore(firebaseApp);
}

let state = loadLocalState();
let started = false;
let startPromise: Promise<void> | null = null;
let firestoreUnsubscribes: Unsubscribe[] = [];
const listeners = new Set<(next: ClassroomState) => void>();
let channel: BroadcastChannel | null = null;

function sortByNumber(students: Student[]): Student[] {
  return [...students].sort((a, b) => a.number - b.number);
}

function sortByNewest<T extends { timestamp?: string; requestedAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = a.timestamp ?? a.requestedAt ?? '';
    const bTime = b.timestamp ?? b.requestedAt ?? '';
    return bTime.localeCompare(aTime);
  });
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function notify(next: ClassroomState, persistLocal = true): void {
  state = {
    ...next,
    students: sortByNumber(next.students),
    transactions: sortByNewest(next.transactions),
    redemptions: sortByNewest(next.redemptions),
  };
  if (hasWindow() && persistLocal) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
    if ('BroadcastChannel' in window) {
      channel ??= new BroadcastChannel('class-points-live');
      channel.postMessage(state);
    }
  }
  listeners.forEach((listener) => listener(state));
}

async function seedFirestoreIfNeeded(db: Firestore): Promise<void> {
  const studentSnapshot = await getDocs(collection(db, COLLECTIONS.students));
  const rewardSnapshot = await getDocs(collection(db, COLLECTIONS.rewards));
  if (studentSnapshot.empty || rewardSnapshot.empty) {
    const batch = writeBatch(db);
    if (studentSnapshot.empty) {
      seedStudents.forEach((student) => batch.set(doc(db, COLLECTIONS.students, student.id), student));
    }
    if (rewardSnapshot.empty) {
      seedRewards.forEach((reward) => batch.set(doc(db, COLLECTIONS.rewards, reward.id), reward));
    }
    await batch.commit();
  }
}

async function startFirestore(db: Firestore): Promise<void> {
  await seedFirestoreIfNeeded(db);
  const readAll = async (): Promise<void> => {
    const [studentSnapshot, transactionSnapshot, rewardSnapshot, redemptionSnapshot] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.students)),
      getDocs(collection(db, COLLECTIONS.transactions)),
      getDocs(collection(db, COLLECTIONS.rewards)),
      getDocs(collection(db, COLLECTIONS.redemptions)),
    ]);
    notify({
      students: studentSnapshot.docs.map((item) => item.data() as Student),
      transactions: transactionSnapshot.docs.map((item) => item.data() as Transaction),
      rewards: rewardSnapshot.docs.map((item) => item.data() as Reward),
      redemptions: redemptionSnapshot.docs.map((item) => item.data() as Redemption),
    }, false);
  };
  await readAll();
  const attach = <T extends keyof ClassroomState>(
    key: T,
    collectionName: string,
    parse: (value: Record<string, unknown>) => ClassroomState[T][number],
  ) => {
    firestoreUnsubscribes.push(onSnapshot(collection(db, collectionName), (snapshot) => {
      const next = { ...state, [key]: snapshot.docs.map((item) => parse(item.data())) };
      notify(next, false);
    }));
  };
  attach('students', COLLECTIONS.students, (value) => value as ClassroomState['students'][number]);
  attach('transactions', COLLECTIONS.transactions, (value) => value as ClassroomState['transactions'][number]);
  attach('rewards', COLLECTIONS.rewards, (value) => value as ClassroomState['rewards'][number]);
  attach('redemptions', COLLECTIONS.redemptions, (value) => value as ClassroomState['redemptions'][number]);
}

export const classroomData = {
  mode: firestore ? 'firestore' : 'local-preview',
  isFirestoreConnected: Boolean(firestore),
  getState(): ClassroomState {
    return state;
  },
  async start(): Promise<void> {
    if (started) return startPromise ?? Promise.resolve();
    started = true;
    if (!firestore) return;
    startPromise = startFirestore(firestore).catch(() => {
      // Keep the local preview available if Firestore rules/config are incomplete.
      notify(state);
    });
    return startPromise;
  },
  subscribe(listener: (next: ClassroomState) => void): () => void {
    listeners.add(listener);
    listener(state);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        notify(JSON.parse(event.newValue) as ClassroomState, false);
      } catch {
        // Ignore malformed cross-tab values.
      }
    };
    const onCustom = (event: Event) => {
      const next = (event as CustomEvent<ClassroomState>).detail;
      if (next) listener(next);
    };
    const onBroadcast = (event: MessageEvent<ClassroomState>) => {
      if (event.data) {
        state = event.data;
        listener(state);
      }
    };
    if (hasWindow()) {
      window.addEventListener('storage', onStorage);
      window.addEventListener(EVENT_NAME, onCustom);
      if ('BroadcastChannel' in window) {
        channel ??= new BroadcastChannel('class-points-live');
        channel.addEventListener('message', onBroadcast);
      }
    }
    return () => {
      listeners.delete(listener);
      if (hasWindow()) {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(EVENT_NAME, onCustom);
        channel?.removeEventListener('message', onBroadcast);
      }
    };
  },
  addPoints(studentIds: string[], amount: number, reason: string): void {
    const now = new Date().toISOString();
    const selected = new Set(studentIds);
    const students = state.students.map((student) =>
      selected.has(student.id) ? { ...student, points: Math.max(0, student.points + amount) } : student,
    );
    const transactions = [
      ...studentIds.map((studentId) => {
        const student = state.students.find((item) => item.id === studentId);
        return student
          ? { id: uid('transaction'), studentId, studentName: student.name, amount, reason, timestamp: now }
          : null;
      }).filter((item): item is Transaction => Boolean(item)),
      ...state.transactions,
    ];
    notify({ ...state, students, transactions });
    if (firestore) {
      const db = firestore;
      void (async () => {
        const batch = writeBatch(db);
        studentIds.forEach((studentId) => {
          const student = state.students.find((item) => item.id === studentId);
          if (student) batch.set(doc(db, COLLECTIONS.students, studentId), student);
        });
        transactions.slice(0, studentIds.length).forEach((transaction) => {
          batch.set(doc(db, COLLECTIONS.transactions, transaction.id), transaction);
        });
        await batch.commit();
      })();
    }
  },
  async requestRedemption(studentId: string, rewardId: string): Promise<boolean> {
    const student = state.students.find((item) => item.id === studentId);
    const reward = state.rewards.find((item) => item.id === rewardId);
    if (!student || !reward || student.points < reward.cost) return false;
    const redemption: Redemption = {
      id: uid('redemption'),
      studentId,
      studentName: student.name,
      rewardId,
      rewardTitle: reward.title,
      cost: reward.cost,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    notify({ ...state, redemptions: [redemption, ...state.redemptions] });
    if (firestore) await setDoc(doc(firestore, COLLECTIONS.redemptions, redemption.id), redemption);
    return true;
  },
  async decideRedemption(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
    const redemption = state.redemptions.find((item) => item.id === id);
    if (!redemption || redemption.status !== 'pending') return false;
    if (firestore && status === 'approved') {
      const db = firestore;
      const approved = await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, COLLECTIONS.students, redemption.studentId);
        const redemptionRef = doc(db, COLLECTIONS.redemptions, id);
        const studentSnapshot = await transaction.get(studentRef);
        const redemptionSnapshot = await transaction.get(redemptionRef);
        const currentStudent = studentSnapshot.data() as Student | undefined;
        const currentRedemption = redemptionSnapshot.data() as Redemption | undefined;
        if (!currentStudent || !currentRedemption || currentRedemption.status !== 'pending' || currentStudent.points < redemption.cost) return false;
        const pointTransaction: Transaction = {
          id: uid('transaction'),
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          amount: -redemption.cost,
          reason: `보상 교환: ${redemption.rewardTitle}`,
          timestamp: new Date().toISOString(),
        };
        transaction.update(studentRef, { points: currentStudent.points - redemption.cost });
        transaction.update(redemptionRef, { status: 'approved' });
        transaction.set(doc(db, COLLECTIONS.transactions, pointTransaction.id), pointTransaction);
        return true;
      });
      if (!approved) return false;
      await this.start();
      return true;
    }
    const nextRedemptions = state.redemptions.map((item) => item.id === id ? { ...item, status } : item);
    if (status === 'approved') {
      const student = state.students.find((item) => item.id === redemption.studentId);
      if (!student || student.points < redemption.cost) return false;
      const transaction: Transaction = {
        id: uid('transaction'),
        studentId: student.id,
        studentName: student.name,
        amount: -redemption.cost,
        reason: `보상 교환: ${redemption.rewardTitle}`,
        timestamp: new Date().toISOString(),
      };
      notify({
        ...state,
        students: state.students.map((item) => item.id === student.id ? { ...item, points: item.points - redemption.cost } : item),
        transactions: [transaction, ...state.transactions],
        redemptions: nextRedemptions,
      });
      if (firestore) {
        const batch = writeBatch(firestore);
        batch.update(doc(firestore, COLLECTIONS.students, student.id), { points: student.points - redemption.cost });
        batch.update(doc(firestore, COLLECTIONS.redemptions, id), { status });
        batch.set(doc(firestore, COLLECTIONS.transactions, transaction.id), transaction);
        await batch.commit();
      }
    } else {
      notify({ ...state, redemptions: nextRedemptions });
      if (firestore) await setDoc(doc(firestore, COLLECTIONS.redemptions, id), { ...redemption, status });
    }
    return true;
  },
  resetPreview(): void {
    notify(cloneSeed());
    if (firestore) {
      firestoreUnsubscribes.forEach((unsubscribe) => unsubscribe());
      firestoreUnsubscribes = [];
      started = false;
      void this.start();
    }
  },
};