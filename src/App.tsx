import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { auth, api, ws } from '@appdeploy/client';
import {
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Users,
  ClipboardCheck,
  Plus,
  LogOut,
  Menu,
  X,
  CalendarDays,
  KeyRound,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Search,
  Video,
  ExternalLink,
  Link2,
  Share2,
  Copy,
  Bell,
} from 'lucide-react';

type User = { userId: string; email?: string; name?: string; picture?: string };
type Profile = {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatarUrl?: string;
};
type Classroom = {
  id: string;
  name: string;
  subject: string;
  code: string;
  teacherId: string;
};
type Assignment = {
  id: string;
  title: string;
  description: string;
  classId: string;
  dueDate: string;
  teacherId: string;
};
type Session = { id: string; classId: string; code: string; createdAt: string };
type LiveClass = { id: string; classId: string; title: string; meetingUrl: string; scheduledAt: string; teacherName: string; createdAt: string; durationMinutes?: number; expiresAt?: string };
type AppNotification = { id: string; title: string; message: string; createdAt: string; read: boolean };
type AttendanceSummary = { classId: string; className: string; total: number; attended: number; missed: number; records: { id: string; createdAt: string; attended: boolean }[] };
type Attendance = {
  id: string;
  classId: string;
  studentId: string;
  studentEmail: string;
  createdAt: string;
};
type ChatMessage = { id: string; text: string; authorName: string; authorRole: string; avatarUrl?: string; createdAt: string; userId: string };
type Material = { id: string; title: string; fileName: string; contentType: string; classId: string; className: string; uploaderName: string; createdAt: string; url: string };
type OfflineWrite = { id: string; method: 'post' | 'put'; url: string; body: any; createdAt: number };
const OFFLINE_QUEUE_KEY = 'classbridge:pending-writes';

function queueOfflineWrite(method: OfflineWrite['method'], url: string, body: any) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as OfflineWrite[];
  queue.push({ id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), method, url, body, createdAt: Date.now() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

async function syncOfflineWrites() {
  if (!navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as OfflineWrite[];
  const remaining: OfflineWrite[] = [];
  for (const item of queue) {
    try {
      if (item.method === 'post') await api.post(item.url, item.body);
      else await api.put(item.url, item.body);
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
}


const roles = [
  {
    id: 'student',
    title: 'Student',
    desc: 'Join classes, view lessons and submit work.',
    icon: GraduationCap,
  },
  {
    id: 'teacher',
    title: 'Teacher',
    desc: 'Create classes, assignments and attendance.',
    icon: BookOpen,
  },
  {
    id: 'admin',
    title: 'Administrator',
    desc: 'Manage accounts, roles and the whole platform.',
    icon: ShieldCheck,
  },
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try { return JSON.parse(localStorage.getItem('classbridge:notifications') || '[]') as AppNotification[]; } catch { return []; }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationToast, setNotificationToast] = useState<{ title: string; message: string } | null>(null);
  const [liveDuration, setLiveDuration] = useState('60');
  const [section, setSection] = useState('overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveClass[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveClass, setLiveClass] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [liveScheduledAt, setLiveScheduledAt] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [assignmentClass, setAssignmentClass] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attendanceCode, setAttendanceCode] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialClass, setMaterialClass] = useState('');
  const socketRef = useRef<ReturnType<typeof ws.connect> | null>(null);

  function addNotification(title: string, message: string) {
    const item: AppNotification = { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2), title, message, createdAt: new Date().toISOString(), read: false };
    setNotifications(current => {
      const next = [item, ...current].slice(0, 40);
      localStorage.setItem('classbridge:notifications', JSON.stringify(next));
      return next;
    });
    setNotificationToast({ title, message });
    window.setTimeout(() => setNotificationToast(current => current?.title === title && current?.message === message ? null : current), 5500);
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'visible') {
      try { new Notification(title, { body: message, icon: '/favicon.ico' }); } catch {}
    }
  }

  function markNotificationsRead() {
    setNotifications(current => {
      const next = current.map(item => ({ ...item, read: true }));
      localStorage.setItem('classbridge:notifications', JSON.stringify(next));
      return next;
    });
  }

  async function requestNotificationPermission() {
    try {
      if (Capacitor.isNativePlatform()) {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive !== 'granted') permission = await PushNotifications.requestPermissions();
        if (permission.receive === 'granted') {
          await PushNotifications.register();
          setNotice('Push notifications enabled. This device is registering with Firebase Cloud Messaging.');
        } else {
          setNotice('Notifications were not enabled. You can allow them later in Android Settings.');
        }
        return;
      }
      if ('Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') addNotification('Notifications enabled', 'ClassBridge can now show alerts while this browser is open.');
      }
    } catch (e) {
      setError('Could not enable notifications on this device. Check notification permissions and try again.');
    }
  }

  async function loadData() {
    try {
      const me = await api.get('/api/me');
      const nextProfile = me.data.profile as Profile;
      setProfile(nextProfile);
      setProfileName(nextProfile.name || '');
      localStorage.setItem('classbridge:profile', JSON.stringify(nextProfile));
      const data = await api.get('/api/dashboard');
      const nextClasses = data.data.classes || [];
      const nextAssignments = data.data.assignments || [];
      const nextSessions = data.data.sessions || [];
      const liveData = await api.get('/api/live-classes');
      const now = Date.now();
      const availableLiveSessions = (liveData.data.sessions || []).filter((item: LiveClass) => {
        const expiry = item.expiresAt ? new Date(item.expiresAt).getTime() : new Date(item.scheduledAt || item.createdAt).getTime() + (Number(item.durationMinutes) || 60) * 60000;
        return Number.isFinite(expiry) && expiry > now;
      });
      setLiveSessions(availableLiveSessions);
      if (nextProfile.role === 'student') {
        const summaryData = await api.get('/api/attendance/summary');
        setAttendanceSummary(summaryData.data.summary || []);
      }
      setClasses(nextClasses);
      setAssignments(nextAssignments);
      setSessions(nextSessions);
      localStorage.setItem('classbridge:dashboard', JSON.stringify({
        classes: nextClasses, assignments: nextAssignments, sessions: nextSessions
      }));
      localStorage.setItem('classbridge:live-classes', JSON.stringify(availableLiveSessions));
      if (nextProfile.role === 'student') localStorage.setItem('classbridge:attendance-summary', JSON.stringify(attendanceSummary));
      if (nextProfile.role === 'admin') {
        const people = await api.get('/api/admin/users');
        setUsers(people.data.users || []);
        localStorage.setItem('classbridge:users', JSON.stringify(people.data.users || []));
      }
      if (nextProfile.role !== 'pending') {
        const materialData = await api.get('/api/materials');
        setMaterials(materialData.data.materials || []);
        localStorage.setItem('classbridge:materials', JSON.stringify(materialData.data.materials || []));
      }
    } catch (e) {
      const savedProfile = localStorage.getItem('classbridge:profile');
      const savedDashboard = localStorage.getItem('classbridge:dashboard');
      if (!savedProfile || !savedDashboard) throw e;
      const cachedProfile = JSON.parse(savedProfile) as Profile;
      const cachedDashboard = JSON.parse(savedDashboard);
      setProfile(cachedProfile);
      setProfileName(cachedProfile.name || '');
      setClasses(cachedDashboard.classes || []);
      setAssignments(cachedDashboard.assignments || []);
      setSessions(cachedDashboard.sessions || []);
      setLiveSessions(JSON.parse(localStorage.getItem('classbridge:live-classes') || '[]'));
      setAttendanceSummary(JSON.parse(localStorage.getItem('classbridge:attendance-summary') || '[]'));
      setUsers(JSON.parse(localStorage.getItem('classbridge:users') || '[]'));
      setMaterials(JSON.parse(localStorage.getItem('classbridge:materials') || '[]'));
      setNotice('Offline mode: showing the latest information saved on this device. New changes will need an internet connection.');
    }  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Keep the app's cached classroom data from being evicted where supported.
        if ('storage' in navigator && 'persist' in navigator.storage) {
          await navigator.storage.persist().catch(() => false);
        }
        const current = await auth.getUser();
        if (active && current) {
          setUser(current);
          localStorage.setItem('classbridge:user', JSON.stringify(current));
          await loadData();
        } else if (active) {
          const savedUser = localStorage.getItem('classbridge:user');
          const savedProfile = localStorage.getItem('classbridge:profile');
          if (!navigator.onLine && savedUser && savedProfile) {
            setUser(JSON.parse(savedUser) as User);
            setProfile(JSON.parse(savedProfile) as Profile);
            setProfileName((JSON.parse(savedProfile) as Profile).name || '');
            const cached = JSON.parse(localStorage.getItem('classbridge:dashboard') || '{}');
            setClasses(cached.classes || []);
            setAssignments(cached.assignments || []);
            setSessions(cached.sessions || []);
            setMaterials(JSON.parse(localStorage.getItem('classbridge:materials') || '[]'));
            setUsers(JSON.parse(localStorage.getItem('classbridge:users') || '[]'));
            setNotice('You are offline. Showing saved classroom information.');
          }
        }
      } catch (e) {
        if (active) {
          const savedUser = localStorage.getItem('classbridge:user');
          const savedProfile = localStorage.getItem('classbridge:profile');
          if (!navigator.onLine && savedUser && savedProfile) {
            setUser(JSON.parse(savedUser) as User);
            const cachedProfile = JSON.parse(savedProfile) as Profile;
            setProfile(cachedProfile);
            setProfileName(cachedProfile.name || '');
            const cached = JSON.parse(localStorage.getItem('classbridge:dashboard') || '{}');
            setClasses(cached.classes || []);
            setAssignments(cached.assignments || []);
            setSessions(cached.sessions || []);
            setMaterials(JSON.parse(localStorage.getItem('classbridge:materials') || '[]'));
            setUsers(JSON.parse(localStorage.getItem('classbridge:users') || '[]'));
            setNotice('You are offline. Showing saved classroom information.');
          } else {
            setError('We could not restore your session. Please connect to the internet and try again.');
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function signIn() {
    setError('');
    try {
      // Keep the user's secure session restorable on later app launches.
      await auth.signInWithRedirect({
        scope: 'openid email profile offline_access',
      });
    } catch {
      setError(
        'Sign-in could not start. Check your browser storage and try again.'
      );
    }
  }

  useEffect(() => {
    if (!user) return;
    const syncWhenOnline = async () => {
      const before = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]').length;
      await syncOfflineWrites();
      const after = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]').length;
      if (before > after) {
        setNotice('Your saved offline changes have been synchronised.');
        await loadData();
      }
    };
    window.addEventListener('online', syncWhenOnline);
    if (navigator.onLine) syncWhenOnline();
    return () => window.removeEventListener('online', syncWhenOnline);
  }, [user?.userId]);

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;
    let active = true;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    (async () => {
      try {
        handles.push(await PushNotifications.addListener('registration', token => {
          if (!active) return;
          // The app server must securely associate this FCM token with the signed-in user.
          localStorage.setItem('classbridge:fcm-token', token.value);
          setNotice('This device is registered for push notifications.');
        }));
        handles.push(await PushNotifications.addListener('registrationError', () => {
          if (active) setError('Push notification registration failed. Check Firebase Android setup.');
        }));
        handles.push(await PushNotifications.addListener('pushNotificationReceived', notification => {
          if (active) addNotification(notification.title || 'ClassBridge update', notification.body || 'You have a new classroom notification.');
        }));
        handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', () => {
          if (active) {
            setNotificationsOpen(true);
            setSection('overview');
          }
        }));
      } catch {
        if (active) setError('Could not start push notifications on this device.');
      }
    })();
    return () => {
      active = false;
      handles.forEach(handle => { void handle.remove(); });
    };
  }, [user?.userId]);

  useEffect(() => {
    if (!user) return;
    const connection = ws.connect();
    socketRef.current = connection;
    connection.onMessage(message => {
      if (message?.type !== 'entity.update') return;
      const payload = message.payload;
      if (payload?.entity_type === 'community' && payload?.entity_id === 'global') {
        const incoming = payload.data as ChatMessage;
        const notificationKey = 'classbridge:chat-notified:' + incoming.id;
        if (incoming.userId !== user.userId && !localStorage.getItem(notificationKey)) {
          addNotification('New community message', incoming.authorName + ' posted a message in the school community.');
          localStorage.setItem(notificationKey, '1');
        }
        setChatMessages(current => {
          if (current.some(item => item.id === incoming.id)) return current;
          return [...current, incoming].slice(-100);
        });
      }
    });
    return () => {
      connection.disconnect();
      socketRef.current = null;
    };
  }, [user?.userId]);

  useEffect(() => {
    if (!user || profile?.role === 'pending' || section !== 'community') return;
    let active = true;
    (async () => {
      try {
        const result = await api.get('/api/community/messages');
        if (active) setChatMessages(result.data.messages || []);
        await socketRef.current?.ready;
        const connectionId = socketRef.current?.connectionId;
        if (connectionId) await api.post('/api/community/subscribe', { connectionId });
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not open community chat.');
      }
    })();
    return () => {
      active = false;
      const connectionId = socketRef.current?.connectionId;
      if (connectionId) api.post('/api/community/unsubscribe', { connectionId }).catch(() => {});
    };
  }, [user?.userId, profile?.role, section]);

  async function signOut() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    await auth.signOut();
    setUser(null);
    setProfile(null);
    setClasses([]);
    setAssignments([]);
    setUsers([]);
  }

  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      if (!navigator.onLine) {
        queueOfflineWrite('post', '/api/classes', { name: className, subject });
        const pendingClass: Classroom = { id: 'offline-' + Date.now(), name: className, subject, code: 'Pending sync', teacherId: user?.userId || '' };
        setClasses(current => [...current, pendingClass]);
        const cached = JSON.parse(localStorage.getItem('classbridge:dashboard') || '{}');
        localStorage.setItem('classbridge:dashboard', JSON.stringify({ ...cached, classes: [...(cached.classes || []), pendingClass] }));
        setNotice('Class saved on this device. It will sync when you reconnect.');
      } else {
        await api.post('/api/classes', { name: className, subject });
        addNotification('New classroom created', className + ' is now available in ClassBridge.');
        setNotice('Your classroom has been created.');
        await loadData();
      }
      setClassName('');
      setSubject('');
    });
  }

  async function joinClass(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      const body = { code: joinCode.trim().toUpperCase() };
      if (!navigator.onLine) {
        queueOfflineWrite('post', '/api/classes/join', body);
        setNotice('Your join request is saved and will sync when you reconnect.');
      } else {
        await api.post('/api/classes/join', body);
        setNotice('You joined the classroom.');
        await loadData();
      }
      setJoinCode('');
    });
  }

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      const body = { title: assignmentTitle, description: assignmentDesc, classId: assignmentClass, dueDate };
      if (!navigator.onLine) {
        queueOfflineWrite('post', '/api/assignments', body);
        const pendingAssignment: Assignment = { id: 'offline-' + Date.now(), ...body, teacherId: user?.userId || '' };
        setAssignments(current => [...current, pendingAssignment]);        const cached = JSON.parse(localStorage.getItem('classbridge:dashboard') || '{}');
        localStorage.setItem('classbridge:dashboard', JSON.stringify({ ...cached, assignments: [...(cached.assignments || []), pendingAssignment] }));
        setNotice('Assignment saved on this device. It will publish when you reconnect.');
      } else {
        await api.post('/api/assignments', body);
        addNotification('New assignment published', assignmentTitle + ' is now available.');
        setNotice('Assignment published.');
        await loadData();
      }
      setAssignmentTitle('');
      setAssignmentDesc('');
      setDueDate('');
    });
  }

  async function startAttendance(classId: string) {
    await action(async () => {
      const result = await api.post('/api/attendance/start', { classId });
      setNotice('Attendance code created: ' + result.data.code);
      await loadData();
    });
  }

  async function createLiveClass(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      const durationMinutes = Math.max(5, Math.min(480, Number(liveDuration) || 60));
      const startsAt = liveScheduledAt ? new Date(liveScheduledAt) : new Date();
      const expiresAt = new Date(startsAt.getTime() + durationMinutes * 60000).toISOString();
      const result = await api.post('/api/live-classes', { classId: liveClass, title: liveTitle.trim(), meetingUrl: meetingUrl.trim(), scheduledAt: liveScheduledAt, durationMinutes, expiresAt });
      const savedSession = { ...result.data.session, durationMinutes: result.data.session?.durationMinutes || durationMinutes, expiresAt: result.data.session?.expiresAt || expiresAt };
      setLiveSessions(current => [savedSession, ...current]);
      localStorage.setItem('classbridge:live-classes', JSON.stringify([savedSession, ...liveSessions]));
      addNotification('Live class scheduled', liveTitle.trim() + ' will be available for ' + durationMinutes + ' minutes.');
      setLiveTitle(''); setMeetingUrl(''); setLiveScheduledAt(''); setLiveDuration('60');
      setNotice('Live class session created. Students in this classroom can now join.');
    });
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refreshLiveClasses = async () => {
      if (!navigator.onLine) return;
      try {
        const dashboardResult = await api.get('/api/dashboard');
        if (!active) return;
        const oldDashboard = JSON.parse(localStorage.getItem('classbridge:dashboard') || '{}');
        const oldClassIds = new Set((oldDashboard.classes || []).map((item: Classroom) => item.id));
        const oldAssignmentIds = new Set((oldDashboard.assignments || []).map((item: Assignment) => item.id));
        (dashboardResult.data.classes || []).forEach((item: Classroom) => { if (!oldClassIds.has(item.id)) addNotification('New classroom available', item.name + ' has been added to ClassBridge.'); });
        (dashboardResult.data.assignments || []).forEach((item: Assignment) => { if (!oldAssignmentIds.has(item.id)) addNotification('New assignment published', item.title + ' is ready to view.'); });
        localStorage.setItem('classbridge:dashboard', JSON.stringify({ classes: dashboardResult.data.classes || [], assignments: dashboardResult.data.assignments || [], sessions: dashboardResult.data.sessions || [] }));
        const result = await api.get('/api/live-classes');
        if (!active) return;
        const incoming = (result.data.sessions || []) as LiveClass[];
        const now = Date.now();
        const available = incoming.filter(item => {
          const expiry = item.expiresAt ? new Date(item.expiresAt).getTime() : new Date(item.scheduledAt || item.createdAt).getTime() + (Number(item.durationMinutes) || 60) * 60000;
          return Number.isFinite(expiry) && expiry > now;
        });
        const previousIds = new Set((JSON.parse(localStorage.getItem('classbridge:live-classes') || '[]') as LiveClass[]).map(item => item.id));
        available.forEach(item => { if (!previousIds.has(item.id)) addNotification('New live class available', item.title + ' has been posted for your classroom.'); });
        const notifiedStarts = new Set(JSON.parse(localStorage.getItem('classbridge:live-start-notified') || '[]') as string[]);
        available.forEach(item => {
          const startsAt = new Date(item.scheduledAt || item.createdAt).getTime();
          if (Number.isFinite(startsAt) && startsAt <= now && !notifiedStarts.has(item.id)) {
            addNotification('Your live class is now ongoing', item.title + ' is ready to join.');
            notifiedStarts.add(item.id);
          }
        });
        localStorage.setItem('classbridge:live-start-notified', JSON.stringify([...notifiedStarts]));
        setLiveSessions(available);
        localStorage.setItem('classbridge:live-classes', JSON.stringify(available));
      } catch {}
    };
    const timer = window.setInterval(refreshLiveClasses, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.userId]);

  async function markAttendance(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      await api.post('/api/attendance/mark', {
        code: attendanceCode.trim().toUpperCase(),
      });
      setAttendanceCode('');
      setNotice('You have been marked present.');
    });
  }

  async function showAttendance(classId: string) {
    setSelectedClass(classId);
    await action(async () => {
      const result = await api.get(
        '/api/attendance/' + encodeURIComponent(classId)
      );
      setAttendance(result.data.attendance || []);
      setSection('attendance');
    });
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      let avatarBase64: string | undefined;
      let avatarContentType: string | undefined;
      if (profileFile) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not read that image.'));
          reader.readAsDataURL(profileFile);
        });
        avatarBase64 = dataUrl.split(',')[1];
        avatarContentType = profileFile.type;
      }
      const body = { name: profileName.trim(), avatarBase64, avatarContentType };
      if (!navigator.onLine) {
        if (avatarBase64) throw new Error('Profile photo changes need an internet connection. You can save your name offline.');
        queueOfflineWrite('put', '/api/profile', body);
        const updatedProfile = { ...profile!, name: profileName.trim() };
        setProfile(updatedProfile);
        localStorage.setItem('classbridge:profile', JSON.stringify(updatedProfile));
        setNotice('Profile name saved on this device. It will sync when you reconnect.');
      } else {
        const result = await api.put('/api/profile', body);
        setProfile(result.data.profile);
        localStorage.setItem('classbridge:profile', JSON.stringify(result.data.profile));
        setNotice('Your profile has been updated.');
      }
      setProfileFile(null);
    });
  }

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim()) return;
    await action(async () => {
      if (!navigator.onLine) {
        const body = { text: chatText.trim() };
        queueOfflineWrite('post', '/api/community/messages', body);
        const pendingMessage: ChatMessage = { id: 'offline-' + Date.now(), text: body.text, authorName: profile?.name || 'You', authorRole: profile?.role || 'student', createdAt: new Date().toISOString(), userId: user?.userId || '' };
        setChatMessages(current => [...current, pendingMessage].slice(-100));
        setNotice('Message saved. It will send when you reconnect.');
      } else {
        const result = await api.post('/api/community/messages', { text: chatText.trim() });
        setChatMessages(current => current.some(item => item.id === result.data.message.id) ? current : [...current, result.data.message].slice(-100));
      }
      setChatText('');
    });
  }

  async function uploadMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!materialFile) return;
    await action(async () => {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(materialFile);
      });
      await api.post('/api/materials', { title: materialTitle.trim() || materialFile.name, fileName: materialFile.name, contentType: materialFile.type || 'application/octet-stream', classId: materialClass, contentBase64: dataUrl.split(',')[1] });
      setMaterialTitle(''); setMaterialFile(null);
      const input = document.getElementById('material-file') as HTMLInputElement | null;
      if (input) input.value = '';
      const refreshed = await api.get('/api/materials');
      setMaterials(refreshed.data.materials || []);
      setNotice('Class material uploaded successfully.');
    });
  }

  async function updateRole(userId: string, role: string) {
    await action(async () => {
      const url = '/api/admin/users/' + encodeURIComponent(userId);
      if (!navigator.onLine) {
        queueOfflineWrite('put', url, { role });
        setNotice('Role change saved and will sync when you reconnect.');
      } else {
        await api.put(url, { role });
        setNotice('User role updated.');
        await loadData();
      }
    });
  }

  if (loading)
    return (
      <main className="brand-splash" aria-label="ClassBridge opening screen">
        <div className="splash-glow" />
        <div className="splash-content">
          <div className="splash-mark">
            <BookOpen size={42} strokeWidth={1.8} />
          </div>
          <h1>
            Class<span>Bridge</span>
          </h1>
          <p className="splash-tagline">Learn. Connect. Achieve.</p>
          <div className="splash-loader" aria-hidden="true">
            <span />
          </div>
          <small>Built by Favour</small>
        </div>
      </main>
    );

  if (!user)
    return (
      <main className="landing">
        <nav className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <BookOpen size={22} />
            </span>
            <span>
              Class<span className="brand-accent">Bridge</span>
            </span>
          </div>
          <span className="nav-note">A better way to learn together</span>
        </nav>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={15} /> YOUR DIGITAL CLASSROOM
            </div>
            <h1>
              Learning works
              <br />
              <span>better together.</span>
            </h1>
            <p>
              One simple place for teachers to teach, students to grow, and
              school administrators to keep everything connected.
            </p>
            <button className="primary-btn large" onClick={signIn}>
              Continue with Google <ArrowRight size={18} />
            </button>
            <small>
              Secure sign-in powered by Google. No password is shared with
              ClassBridge.
            </small>
            {error && <div className="error">{error}</div>}
          </div>
          <div className="hero-card">
            <div className="card-top">
              <span className="live-dot" /> CLASSROOM OVERVIEW{' '}
              <span className="dots">•••</span>            </div>
            <div className="welcome">
              Good things happen
              <br />
              when we learn.
            </div>
            <div className="student-photo-strip" aria-label="Students learning together">
              <img
                src="https://images.unsplash.com/photo-1758270705317-3ef6142d306f?auto=format&fit=crop&w=900&q=82"
                alt="A diverse group of students working together on a laptop"
                loading="lazy"
              />
              <img
                src="https://images.unsplash.com/photo-1758270705290-62b6294dd044?auto=format&fit=crop&w=900&q=82"
                alt="Students collaborating on a classroom project"
                loading="lazy"
              />
              <div className="student-photo-caption">
                <strong>Learn together</strong>
                <span>Share ideas. Build your future.</span>
              </div>
            </div>
            <div className="mini-grid">
              <div>
                <BookOpen />
                <b>Classes</b>
                <small>Lessons in one place</small>
              </div>
              <div>
                <ClipboardCheck />
                <b>Assignments</b>
                <small>Stay on track</small>
              </div>
              <div>
                <Users />
                <b>Community</b>
                <small>Learn together</small>
              </div>
              <div>
                <CalendarDays />
                <b>Attendance</b>
                <small>Easy daily check-in</small>
              </div>
            </div>
            <div className="progress">
              <span>YOUR NEXT BIG IDEA</span>
              <div>
                <i />
              </div>
            </div>
          </div>
        </section>
        <section className="role-section">
          <div className="section-kicker">BUILT FOR EVERYONE</div>
          <h2>One platform. Three roles.</h2>
          <div className="role-grid">
            {roles.map(r => (
              <div className="role-card" key={r.id}>
                <r.icon size={23} />
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <footer>© 2026 ClassBridge · Learn. Connect. Achieve.</footer>
      </main>
    );

  const role = profile?.role || 'pending';
  const navItems =
    role === 'admin'
      ? [
          ['overview', 'Overview'],
          ['users', 'User management'],
          ['classes', 'Classrooms'],
          ['assignments', 'Assignments'],
          ['liveClasses', 'Live Class Session'],
          ['materials', 'Class material'],
          ['community', 'Community chat'],
          ['profile', 'My profile'],
        ]
      : role === 'teacher'
        ? [
            ['overview', 'Overview'],
            ['classes', 'My classrooms'],          ['assignments', 'Assignments'],
          ['liveClasses', 'Live Class Session'],
          ['attendance', 'Attendance'],
          ['materials', 'Class material'],
            ['community', 'Community chat'],
            ['profile', 'My profile'],
          ]
        : [
            ['overview', 'Overview'],
            ['classes', 'My classrooms'],          ['assignments', 'Assignments'],
          ['liveClasses', 'Live Class Session'],
          ['myAttendance', 'My Attendance'],
          ['share', 'Share ClassBridge'],
          ['materials', 'Class material'],
            ['community', 'Community chat'],
            ['profile', 'My profile'],
          ];

  return (
    <div className="app-shell">
      {!navigator.onLine && <div className="offline-ribbon" role="status">Offline mode · Saved classroom information only</div>}
      <aside className={'sidebar ' + (mobileNav ? 'open' : '')}>
        <div className="brand side-brand">
          <span className="brand-mark">
            <BookOpen size={21} />
          </span>
          <span>
            Class<span className="brand-accent">Bridge</span>
          </span>
          <button className="close-nav" onClick={() => setMobileNav(false)}>
            <X />
          </button>
        </div>
        <div className="school-label">LEARNING SPACE</div>
        <div className="nav-list">
          {navItems.map(([id, label]) => (
            <button
              key={id}
              className={'nav-item ' + (section === id ? 'active' : '')}
              onClick={() => {
                setSection(id);
                setMobileNav(false);
              }}
            >
              <span className="nav-symbol">
                {id === 'overview'
                  ? '⌂'
                  : id === 'users'
                    ? '♙'
                    : id === 'classes'
                      ? '▤'
                      : id === 'attendance' || id === 'myAttendance'
                        ? '✓'
                        : id === 'liveClasses'
                          ? '▶'
                        : id === 'community'
                          ? '◉'
                          : id === 'profile'
                            ? '♙'
                            : id === 'materials'
                              ? '▤'
                              : '▧'}
              </span>
              {label}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="help-box">
            <Sparkles size={18} />
            <b>Keep learning</b>
            <p>Small steps today make big progress tomorrow.</p>
          </div>
          <button className="nav-item logout" onClick={signOut}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      {mobileNav && (
        <div className="scrim" onClick={() => setMobileNav(false)} />
      )}
      <main className="main-area">
        <header className="dashboard-header">
          <button className="menu-btn" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div>
            <div className="crumb">
              CLASSBRIDGE <span>/</span> {section.toUpperCase()}
            </div>
            <h1>
              {section === 'overview'
                ? 'Your learning space'
                : section === 'users'
                  ? 'User management'
                  : section === 'classes'
                    ? 'Classrooms'
                    : section === 'liveClasses'
                      ? 'Live Class Session'
                      : section === 'myAttendance'
                        ? 'My Attendance'
                        : section === 'share'
                          ? 'Share ClassBridge'
                          : section === 'attendance'
                          ? 'Attendance'
                    : section === 'materials'
                      ? 'Class material'
                      : section === 'community'
                        ? 'Community chat'
                        : section === 'profile'
                          ? 'My profile'
                          : 'Assignments'}
            </h1>
          </div>
          <button className="notification-bell" aria-label="Open notifications" onClick={() => { setNotificationsOpen(value => !value); markNotificationsRead(); }}>
            <Bell size={20} />
            {notifications.some(item => !item.read) && <span className="notification-count">{notifications.filter(item => !item.read).length}</span>}
          </button>
          <div className="user-chip">            {profile?.avatarUrl ? <img className="avatar-photo" src={profile.avatarUrl} alt="Profile" /> : <div className="avatar">{(profile?.name || user.name || user.email || 'U').charAt(0).toUpperCase()}</div>}
            <div>
              <b>{profile?.name || user.name || 'Welcome'}</b>
              <small>{profile?.role || 'Pending approval'}</small>
            </div>
          </div>
        </header>
        {notificationToast && <div className="notification-toast" role="status" onClick={() => setNotificationsOpen(true)}>
          <span className="notification-toast-icon"><Bell size={18} /></span>
          <span className="notification-toast-copy"><b>{notificationToast.title}</b><small>{notificationToast.message}</small></span>
          <button aria-label="Dismiss notification" onClick={event => { event.stopPropagation(); setNotificationToast(null); }}>×</button>
        </div>}
        {notificationsOpen && <section className="notification-panel" aria-label="Notifications">
          <div className="notification-panel-head"><b>Notifications</b><button className="text-btn" onClick={markNotificationsRead}>Mark all read</button></div>
          {notifications.length === 0 ? <p className="notification-empty">You're all caught up.</p> : notifications.map(item => <article className="notification-item" key={item.id}><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></article>)}
          {(Capacitor.isNativePlatform() ? !localStorage.getItem('classbridge:fcm-token') : ('Notification' in window && Notification.permission !== 'granted')) && <button className="enable-notifications" onClick={requestNotificationPermission}>Enable device notifications</button>}
        </section>}
        <div className="content">
          {error && (
            <div className="error banner">
              {error}
              <button onClick={() => setError('')}>×</button>
            </div>
          )}
          {notice && (
            <div className="notice banner">
              <CheckCircle2 size={17} /> {notice}
              <button onClick={() => setNotice('')}>×</button>
            </div>
          )}
          {role === 'pending' && (
            <div className="pending-card">
              <Clock3 size={30} />
              <h2>Your account is awaiting approval</h2>
              <p>
                Your Google account is signed in, but an administrator needs to
                assign your role before you can use the classroom tools.
              </p>
              <button className="outline-btn" onClick={() => action(loadData)}>
                Refresh status
              </button>
            </div>
          )}
          {section === 'overview' && role !== 'pending' && (
            <>
              <div className="welcome-banner">
                <div>
                  <span className="section-kicker">WELCOME BACK</span>
                  <h2>{profile?.name || user.name || 'Learner'} 👋</h2>
                  <p>
                    {role === 'admin'
                      ? 'Here is what is happening across your learning platform.'
                      : role === 'teacher'
                        ? 'Your classrooms and teaching tools are ready.'
                        : 'Your classes, assignments and learning journey are right here.'}
                  </p>
                </div>
                <div className="banner-art">
                  <GraduationCap size={78} />
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>CLASSROOMS</span>
                  <b>{classes.length}</b>
                  <small>Available to you</small>
                  <BookOpen />
                </div>
                <div className="stat-card">
                  <span>ASSIGNMENTS</span>
                  <b>{assignments.length}</b>
                  <small>Published work</small>
                  <ClipboardCheck />
                </div>
                <div className="stat-card">
                  <span>YOUR ROLE</span>
                  <b className="role-value">{role}</b>
                  <small>Account access</small>
                  <ShieldCheck />
                </div>
              </div>
              <div className="section-heading">
                <div>
                  <h2>Quick actions</h2>
                  <p>Jump straight into your next task.</p>
                </div>
              </div>
              <div className="quick-grid">
                <button onClick={() => setSection('classes')}>
                  <BookOpen />
                  <b>Explore classrooms</b>
                  <span>View or join a class</span>
                </button>
                <button onClick={() => setSection('assignments')}>
                  <ClipboardCheck />
                  <b>Assignments</b>
                  <span>Check your class work</span>
                </button>
                <button onClick={() => setSection('attendance')}>
                  <CalendarDays />
                  <b>Attendance</b>
                  <span>Manage or mark attendance</span>
                </button>
              </div>
            </>
          )}
          {section === 'classes' && role !== 'pending' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>
                    {role === 'teacher' || role === 'admin'
                      ? 'Your classrooms'
                      : 'My classrooms'}
                  </h2>
                  <p>Organise learning and keep everyone connected.</p>
                </div>
              </div>
              {(role === 'teacher' || role === 'admin') && (
                <form className="form-card inline-form" onSubmit={createClass}>
                  <h3>
                    <Plus size={18} /> Create a classroom
                  </h3>
                  <input
                    required
                    placeholder="Classroom name"
                    value={className}
                    onChange={e => setClassName(e.target.value)}
                  />
                  <input
                    required
                    placeholder="Subject"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                  <button className="primary-btn" disabled={busy}>
                    Create class
                  </button>
                </form>
              )}
              {role === 'student' && (
                <form className="form-card inline-form" onSubmit={joinClass}>
                  <h3>
                    <KeyRound size={18} /> Join a classroom
                  </h3>
                  <input
                    required
                    placeholder="Enter classroom code"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                  />
                  <button className="primary-btn" disabled={busy}>
                    Join class
                  </button>
                </form>
              )}
              <div className="class-grid">
                {classes.map(c => (
                  <div className="class-card" key={c.id}>
                    <div className="class-icon">
                      <BookOpen />
                    </div>
                    <span className="pill">{c.subject}</span>
                    <h3>{c.name}</h3>
                    <p>
                      Classroom code: <b>{c.code}</b>
                    </p>
                    {role !== 'student' && (
                      <button
                        className="text-btn"
                        onClick={() => showAttendance(c.id)}
                      >
                        View attendance <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                ))}
                {classes.length === 0 && (
                  <div className="empty-state">
                    No classrooms yet.{' '}
                    {role === 'student'
                      ? 'Join one using a classroom code.'
                      : 'Create your first classroom above.'}
                  </div>
                )}
              </div>
            </>
          )}
          {section === 'assignments' && role !== 'pending' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Assignments</h2>
                  <p>Keep track of learning tasks and due dates.</p>
                </div>
              </div>
              {(role === 'teacher' || role === 'admin') && (
                <form
                  className="form-card assignment-form"
                  onSubmit={createAssignment}
                >
                  <h3>
                    <Plus size={18} /> Publish an assignment
                  </h3>
                  <input
                    required
                    placeholder="Assignment title"
                    value={assignmentTitle}
                    onChange={e => setAssignmentTitle(e.target.value)}
                  />                  <textarea
                    placeholder="Instructions for students"
                    value={assignmentDesc}
                    onChange={e => setAssignmentDesc(e.target.value)}
                  />
                  <select
                    required
                    value={assignmentClass}
                    onChange={e => setAssignmentClass(e.target.value)}
                  >
                    <option value="">Choose classroom</option>
                    {classes.map(c => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <label>Due date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                  <button className="primary-btn" disabled={busy}>
                    Publish assignment
                  </button>
                </form>
              )}
              <div className="assignment-list">
                {assignments.map(a => (
                  <div className="assignment-card" key={a.id}>
                    <div className="assignment-icon">
                      <ClipboardCheck />
                    </div>
                    <div>
                      <h3>{a.title}</h3>
                      <p>{a.description || 'No extra instructions.'}</p>
                      <small>
                        {a.dueDate ? 'Due ' + a.dueDate : 'No due date set'}
                      </small>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && (
                  <div className="empty-state">
                    No assignments have been published yet.
                  </div>
                )}
              </div>
            </>
          )}
          {section === 'liveClasses' && role !== 'pending' && (
            <section>
              <div className="section-heading"><div><h2>Live Class Session</h2><p>Join a class online through the Google Meet link shared by your teacher.</p></div></div>
              {(role === 'teacher' || role === 'admin') && <form className="form-card inline-form" onSubmit={createLiveClass}>
                <h3><Video size={19} /> Create a live class</h3>
                <input required value={liveTitle} onChange={e => setLiveTitle(e.target.value)} placeholder="Session title, e.g. Biology lesson" />
                <select required value={liveClass} onChange={e => setLiveClass(e.target.value)}><option value="">Choose classroom</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <input required type="url" value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="Paste Google Meet link (https://meet.google.com/...)" />
                <label>Session date and time</label><input type="datetime-local" value={liveScheduledAt} onChange={e => setLiveScheduledAt(e.target.value)} />
                <label>Class duration (minutes)</label><input type="number" min="5" max="480" required value={liveDuration} onChange={e => setLiveDuration(e.target.value)} placeholder="60" />
                <button className="primary-btn" disabled={busy || !liveClass}>Publish live session</button>
              </form>}
              <div className="assignment-list">{liveSessions.filter(session => {
                const expiry = session.expiresAt ? new Date(session.expiresAt).getTime() : new Date(session.scheduledAt || session.createdAt).getTime() + (Number(session.durationMinutes) || 60) * 60000;
                return Number.isFinite(expiry) && expiry > Date.now();
              }).map(session => <article className="assignment-card" key={session.id}>
                <div className="assignment-icon"><Video /></div><div><h3>{session.title}</h3><p>{classes.find(c => c.id === session.classId)?.name || 'Classroom'} · {session.teacherName}</p><small>{session.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'Starts now'} · {session.durationMinutes || 60} min · Ends {new Date(session.expiresAt || (new Date(session.scheduledAt || session.createdAt).getTime() + (Number(session.durationMinutes) || 60) * 60000)).toLocaleTimeString()}</small></div>
                <a className="primary-btn material-download" href={session.meetingUrl} target="_blank" rel="noreferrer">Join meeting <ExternalLink size={15} /></a>
              </article>)}{liveSessions.filter(session => { const expiry = session.expiresAt ? new Date(session.expiresAt).getTime() : new Date(session.scheduledAt || session.createdAt).getTime() + (Number(session.durationMinutes) || 60) * 60000; return Number.isFinite(expiry) && expiry > Date.now(); }).length === 0 && <div className="empty-state">No available live class sessions right now. Expired sessions are automatically hidden.</div>}</div>
            </section>
          )}
          {section === 'myAttendance' && role === 'student' && (
            <section>
              <div className="section-heading"><div><h2>My Attendance</h2><p>Mark yourself present and track the classes you have attended or missed.</p></div></div>
              <form className="form-card attendance-form" onSubmit={markAttendance}><KeyRound size={28} /><h3>Mark yourself present</h3><input required placeholder="Attendance code" value={attendanceCode} onChange={e => setAttendanceCode(e.target.value)} /><button className="primary-btn" disabled={busy}>Mark present</button></form>
              <div className="stats-grid">{[
                { label: 'CLASSES ATTENDED', value: attendanceSummary.reduce((sum, item) => sum + item.attended, 0), hint: 'Your recorded attendance' },
                { label: 'CLASSES MISSED', value: attendanceSummary.reduce((sum, item) => sum + item.missed, 0), hint: 'Sessions without a check-in' },
                { label: 'TOTAL CLASSES', value: attendanceSummary.reduce((sum, item) => sum + item.total, 0), hint: 'All sessions for your classes' },
              ].map(item => <div className="stat-card" key={item.label}><span>{item.label}</span><b>{item.value}</b><small>{item.hint}</small><ClipboardCheck /></div>)}</div>
              <div className="assignment-list">{attendanceSummary.map(item => <article className="assignment-card" key={item.classId}><div className="assignment-icon"><CalendarDays /></div><div><h3>{item.className}</h3><p>{item.attended} attended · {item.missed} missed</p><small>{item.total} attendance sessions</small></div></article>)}{attendanceSummary.length === 0 && <div className="empty-state">Your attendance summary will appear after your teachers create attendance sessions.</div>}</div>
            </section>
          )}
          {section === 'attendance' && role !== 'pending' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Attendance centre</h2>
                  <p>
                    {role === 'student'
                      ? 'Enter the code shared by your teacher to mark yourself present.'
                      : 'Start a check-in session and share its code with your class.'}
                  </p>
                </div>
              </div>
              {role === 'student' ? (
                <form
                  className="form-card attendance-form"
                  onSubmit={markAttendance}
                >
                  <KeyRound size={28} />
                  <h3>Mark yourself present</h3>
                  <input
                    required
                    placeholder="Attendance code"
                    value={attendanceCode}
                    onChange={e => setAttendanceCode(e.target.value)}
                  />
                  <button className="primary-btn" disabled={busy}>
                    Mark present
                  </button>
                </form>
              ) : (
                <div className="class-grid">
                  {classes.map(c => (
                    <div className="class-card" key={c.id}>
                      <div className="class-icon">
                        <CalendarDays />
                      </div>
                      <h3>{c.name}</h3>
                      <button
                        className="primary-btn"
                        onClick={() => startAttendance(c.id)}
                        disabled={busy}
                      >
                        Start attendance
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => showAttendance(c.id)}
                      >
                        View attendance <ArrowRight size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {attendance.length > 0 && (
                <div className="form-card">
                  <h3>Attendance records</h3>
                  {attendance.map(a => (
                    <p className="record-row" key={a.id}>
                      {a.studentEmail} <span>Present</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
          {section === 'share' && role === 'student' && (
            <section>
              <div className="section-heading"><div><h2>Share ClassBridge</h2><p>Help classmates discover the learning platform by sharing its link.</p></div></div>
              <div className="quick-grid">
                <article className="form-card">
                  <Share2 size={28} />
                  <h3>Share the website</h3>
                  <p>Send classmates the ClassBridge website so they can open it in their browser.</p>
                  <button className="primary-btn" onClick={async () => { const url = window.location.origin; if (navigator.share) { try { await navigator.share({ title: 'ClassBridge', text: 'Join me on ClassBridge for school learning.', url }); } catch {} } else { await navigator.clipboard.writeText(url); setNotice('ClassBridge website link copied.'); } }}>Share website link</button>
                  <button className="text-btn" onClick={async () => { await navigator.clipboard.writeText(window.location.origin); setNotice('ClassBridge website link copied.'); }}><Copy size={15} /> Copy website link</button>
                </article>
                <article className="form-card">
                  <Link2 size={28} />
                  <h3>Share the app link</h3>
                  <p>Share this link to open ClassBridge. On supported phones, classmates can use their browser menu to add it to the home screen.</p>
                  <button className="primary-btn" onClick={async () => { const url = window.location.origin; if (navigator.share) { try { await navigator.share({ title: 'ClassBridge app', text: 'Open ClassBridge on your phone.', url }); } catch {} } else { await navigator.clipboard.writeText(url); setNotice('ClassBridge app link copied.'); } }}>Share app link</button>
                  <button className="text-btn" onClick={async () => { await navigator.clipboard.writeText(window.location.origin); setNotice('ClassBridge app link copied.'); }}><Copy size={15} /> Copy app link</button>
                  <small>A separate APK download will be added when an Android app package is available.</small>
                </article>
              </div>
            </section>
          )}
          {section === 'profile' && role !== 'pending' && (
            <section className="profile-layout">
              <div className="profile-intro">
                {profile?.avatarUrl ? <img className="profile-large-photo" src={profile.avatarUrl} alt="Your profile" /> : <div className="profile-large-avatar">{(profileName || user.name || user.email || 'U').charAt(0).toUpperCase()}</div>}
                <div><h2>{profileName || 'Your profile'}</h2><p>{user.email}</p><span className="pill">{role}</span></div>
              </div>
              <form className="form-card profile-form" onSubmit={saveProfile}>
                <h3>Personal information</h3>
                <label>Display name</label>
                <input required maxLength={70} value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" />
                <label>Profile picture</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setProfileFile(e.target.files?.[0] || null)} />
                <small>Choose a JPG, PNG or WebP image (up to 2 MB).</small>
                <button className="primary-btn" disabled={busy}>Save profile</button>
              </form>
            </section>
          )}
          {section === 'community' && role !== 'pending' && (
            <section className="community-panel">
              <div className="section-heading"><div><h2>School community</h2><p>Chat with students, teachers and administrators. Keep it respectful and school-related.</p></div><span className="live-pill"><i /> Live chat</span></div>
              <div className="chat-feed">
                {chatMessages.map(message => <article className={'chat-message ' + (message.userId === user.userId ? 'mine' : '')} key={message.id}>
                  {message.avatarUrl ? <img className="chat-avatar" src={message.avatarUrl} alt="" /> : <div className="chat-avatar-fallback">{message.authorName.charAt(0).toUpperCase()}</div>}
                  <div className="chat-bubble"><div className="chat-meta"><b>{message.authorName}</b><span>{message.authorRole}</span><time>{new Date(message.createdAt).toLocaleString()}</time></div><p>{message.text}</p></div>
                </article>)}
                {chatMessages.length === 0 && <div className="empty-state">No messages yet. Start a friendly school conversation.</div>}
              </div>
              <form className="chat-compose" onSubmit={sendChatMessage}><input maxLength={1000} value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Write a message to the school community…" /><button className="primary-btn" disabled={busy || !chatText.trim()}>Send</button></form>
            </section>
          )}
          {section === 'materials' && role !== 'pending' && (
            <section>              <div className="section-heading"><div><h2>Class material</h2><p>Notes, presentations, worksheets and other files shared by teachers and administrators.</p></div></div>
              {(role === 'teacher' || role === 'admin') && <form className="form-card material-upload" onSubmit={uploadMaterial}><h3>Upload class material</h3><input value={materialTitle} onChange={e => setMaterialTitle(e.target.value)} placeholder="Material title (optional)" /><select required value={materialClass} onChange={e => setMaterialClass(e.target.value)}><option value="">Choose classroom</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input id="material-file" type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={e => setMaterialFile(e.target.files?.[0] || null)} /><small>PDF, Office documents, text files or images. Maximum 8 MB per file.</small><button className="primary-btn" disabled={busy || !materialFile}>Upload material</button></form>}
              <div className="material-grid">{materials.map(item => <article className="material-card" key={item.id}><div className="material-icon"><BookOpen /></div><div className="material-info"><h3>{item.title}</h3><p>{item.className} · {item.fileName}</p><small>Shared by {item.uploaderName} · {new Date(item.createdAt).toLocaleDateString()}</small></div><a className="primary-btn material-download" href={item.url} target="_blank" rel="noreferrer">Open file <ArrowRight size={15} /></a></article>)}{materials.length === 0 && <div className="empty-state">No class materials have been uploaded yet.</div>}</div>
            </section>
          )}
          {section === 'users' && role === 'admin' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Manage accounts</h2>
                  <p>Approve new users and assign classroom roles.</p>
                </div>
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Search users"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="users-table">
                <div className="table-head">
                  <span>USER</span>
                  <span>EMAIL</span>
                  <span>ROLE</span>
                  <span>ACCESS</span>
                </div>
                {users
                  .filter(u =>
                    (u.email || '').toLowerCase().includes(search.toLowerCase())
                  )
                  .map(u => (
                    <div className="table-row" key={u.userId}>
                      <div className="person">
                        <div className="avatar small">
                          {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <b>{u.name || 'New user'}</b>
                      </div>
                      <span>{u.email}</span>
                      <select
                        value={u.role}
                        onChange={e => updateRole(u.userId, e.target.value)}
                        disabled={
                          u.email?.toLowerCase() === 'favourachigati@gmail.com'
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Administrator</option>
                      </select>
                      <span className="status-tag">{u.status || 'Active'}</span>
                    </div>
                  ))}
                {users.length === 0 && (
                  <div className="empty-state">
                    No other accounts have signed in yet.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
