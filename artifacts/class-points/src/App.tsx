import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Award,
  Armchair,
  BookOpen,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Download,
  Expand,
  Gamepad2,
  History,
  LayoutGrid,
  Minus,
  Plus,
  RefreshCcw,
  Sparkles,
  Star,
  Trophy,
  Utensils,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  classroomData,
  type ClassroomState,
  type GroupId,
  type Redemption,
  type Reward,
  type Student,
} from '@/lib/classroom-data';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const quickReasons = ['청소 우수 +10', '1인 1역 완수 +10', '발표 및 수업 태도 우수 +5', '과제 완수 +5'];
const groupColors = [
  { bg: '#e1f0ee', text: '#287276' },
  { bg: '#f9e5dd', text: '#a75545' },
  { bg: '#e8e6f5', text: '#5d598c' },
  { bg: '#f6edcd', text: '#927224' },
];

function useClassroom(): ClassroomState {
  const [data, setData] = useState<ClassroomState>(() => classroomData.getState());
  useEffect(() => {
    const unsubscribe = classroomData.subscribe(setData);
    void classroomData.start();
    return unsubscribe;
  }, []);
  return data;
}

function initials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function rewardIcon(icon: Reward['icon'], size = 18) {
  const props = { size, strokeWidth: 2.2 };
  if (icon === 'seat') return <Armchair {...props} />;
  if (icon === 'meal') return <Utensils {...props} />;
  if (icon === 'book') return <BookOpen {...props} />;
  if (icon === 'game') return <Gamepad2 {...props} />;
  return <Star {...props} />;
}

function AppShell({ children, pendingCount }: { children: ReactNode; pendingCount: number }) {
  const [location] = useLocation();
  const links = [
    { href: '/', label: '실시간 대시보드', icon: LayoutGrid },
    { href: '/shop', label: '보상 상점', icon: Trophy },
    { href: '/approvals', label: '보상 승인', icon: CheckCircle2, count: pendingCount },
    { href: '/history', label: '변동 내역', icon: History },
  ];
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={21} /></div>
          <div><div className="brand-title">우리 반 통장</div><div className="brand-subtitle">{classroomData.isFirestoreConnected ? 'Firestore · 실시간 연결' : '로컬 미리보기 모드'}</div></div>
        </div>
        <nav className="nav" aria-label="Main navigation">
          <div className="nav-label">학급 운영</div>
          {links.map(({ href, label, icon: Icon, count }) => (
            <Link key={href} href={href} className={`nav-item ${location === href ? 'active' : ''}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={18} /><span>{label}</span>{count ? <span className="nav-count" data-testid="text-pending-count">{count}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="teacher-badge"><div className="avatar">MS</div><div><div className="teacher-name">Ms. Morgan</div><div className="teacher-role">Class teacher</div></div></div>
        </div>
      </aside>
      <div className="mobile-nav">
        {links.map(({ href, label, icon: Icon, count }) => (
          <Link key={href} href={href} className={`nav-item ${location === href ? 'active' : ''}`} data-testid={`mobile-link-${label.toLowerCase().replaceAll(' ', '-')}`}>
            <Icon size={17} /><span>{label.split(' ')[0]}</span>{count ? <span className="nav-count">{count}</span> : null}
          </Link>
        ))}
      </div>
      <main className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'full' }).format(new Date())}</div>
            <h1 className="page-title">{location === '/' ? '우리 반의 멋진 순간을 모아요.' : links.find((link) => link.href === location)?.label ?? '우리 반 통장'}</h1>
            <p className="page-intro">{location === '/' ? '수업 중에도 한눈에 보이는 우리 반 포인트 현황입니다.' : '작은 칭찬이 모여 큰 성장을 만들어요.'}</p>
          </div>
          <div className="top-actions">
            <button className="icon-button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" data-testid="button-fullscreen"><Expand size={18} /></button>
            <button className="secondary-button" onClick={() => window.location.reload()} data-testid="button-refresh"><RefreshCcw size={15} /><span>Refresh</span></button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function ToastStack({ messages }: { messages: { id: number; text: string }[] }) {
  return <div className="toast-stack" aria-live="polite">{messages.map((message) => <div className="toast" key={message.id} data-testid={`toast-${message.id}`}><CheckCircle2 size={17} />{message.text}</div>)}</div>;
}

function StatCard({ label, value, note, icon: Icon, color, tint }: { label: string; value: string | number; note: string; icon: typeof Users; color: string; tint: string }) {
  return <div className="stat-card" style={{ '--stat-color': color, '--stat-tint': tint } as CSSProperties} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="stat-top"><span>{label}</span><Icon size={17} className="stat-icon" /></div>
    <div className="stat-value" data-testid={`text-${label.toLowerCase().replaceAll(' ', '-')}-value`}>{value}</div>
    <div className="stat-note">{note}</div>
  </div>;
}

function DashboardPage() {
  const state = useClassroom();
  const [group, setGroup] = useState<'all' | GroupId>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ students: Student[] } | null>(null);
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const pending = state.redemptions.filter((item) => item.status === 'pending').length;
  const filtered = useMemo(() => group === 'all' ? state.students : state.students.filter((student) => student.group === group), [group, state.students]);
  const totalPoints = state.students.reduce((sum, student) => sum + student.points, 0);
  const selectedStudents = state.students.filter((student) => selected.includes(student.id));
  const visibleIds = filtered.map((student) => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const showToast = (text: string) => {
    const id = Date.now();
    setMessages((current) => [...current, { id, text }]);
    window.setTimeout(() => setMessages((current) => current.filter((item) => item.id !== id)), 2600);
  };
  const applyPoints = (students: Student[], amount: number, reason: string) => {
    classroomData.addPoints(students.map((student) => student.id), amount, reason);
    setSelected([]);
    showToast(`${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} point${Math.abs(amount) === 1 ? '' : 's'} · ${students.length} student${students.length === 1 ? '' : 's'}`);
  };
  const toggleStudent = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <>
     <div className="stats-row">
       <StatCard label="우리 반 학생" value={state.students.length} note="오늘도 힘차게 시작해요" icon={Users} color="#2b858b" tint="#b8ded6" />
       <StatCard label="오늘 받은 점수" value={state.transactions.filter((item) => new Date(item.timestamp).toDateString() === new Date().toDateString() && item.amount > 0).reduce((sum, item) => sum + item.amount, 0)} note="칭찬이 쌓이고 있어요" icon={Sparkles} color="#d08e28" tint="#f8dd94" />
       <StatCard label="우리 반 총점" value={totalPoints} note="네 모둠 모두의 포인트" icon={Award} color="#6b679b" tint="#d8d5ec" />
       <StatCard label="승인 대기" value={pending} note={pending ? '선생님의 확인이 필요해요' : '모두 처리했어요'} icon={CheckCircle2} color="#bd6857" tint="#f2c8bd" />
    </div>
    <div className="section-heading">
       <div><h2>오늘의 우리 반</h2><p>학생 카드를 눌러 바로 기록하거나, 여러 명을 선택해 한 번에 지급하세요.</p></div>
      <div className="filter-bar">
         <button className="filter-chip" onClick={() => setSelected(allVisibleSelected ? [] : visibleIds)}>{allVisibleSelected ? '선택 해제' : '전체 선택'}</button>
         {(['all', 1, 2, 3, 4] as const).map((item) => <button key={item} className={`filter-chip ${group === item ? 'active' : ''}`} onClick={() => { setGroup(item); setSelected([]); }} data-testid={`filter-group-${item}`}>{item === 'all' ? '전체' : `${item}분단`}</button>)}
      </div>
    </div>
    {selectedStudents.length ? <div className="batch-bar">
       <div className="batch-label"><span>{selectedStudents.length}</span>명 선택됨</div>
       <select className="batch-select" defaultValue="10" aria-label="일괄 지급 점수" id="batch-amount" data-testid="select-batch-amount"><option value="10">+10점</option><option value="5">+5점</option><option value="-5">−5점</option><option value="1">+1점</option></select>
      <select className="batch-reason" defaultValue={quickReasons[0]} aria-label="Batch point reason" id="batch-reason" data-testid="select-batch-reason">{quickReasons.map((reason) => <option key={reason}>{reason}</option>)}</select>
       <button className="primary-button" onClick={() => { const amount = Number((document.getElementById('batch-amount') as HTMLSelectElement).value); const reason = (document.getElementById('batch-reason') as HTMLSelectElement).value; applyPoints(selectedStudents, amount, reason); }} data-testid="button-apply-batch"><Plus size={16} />선택 학생에게 지급</button>
    </div> : null}
    {filtered.length ? <div className="classroom-grid">
      {filtered.map((student, index) => {
        const palette = groupColors[student.group - 1];
        return <div key={student.id} className={`student-card ${selected.includes(student.id) ? 'selected' : ''}`} style={{ animationDelay: `${index * 35}ms` }} onClick={() => setDialog({ students: [student] })} data-testid={`card-student-${student.id}`}>
          <div className="student-head"><input className="student-check" type="checkbox" checked={selected.includes(student.id)} onChange={() => toggleStudent(student.id)} onClick={(event) => event.stopPropagation()} aria-label={`${student.name} 선택`} /><div className="student-avatar" style={{ '--avatar-bg': palette.bg, '--avatar-text': palette.text } as CSSProperties}>{initials(student.name)}</div><div><div className="student-name">{student.name}</div><div className="student-group">{String(student.number).padStart(2, '0')}번 · {student.group}분단</div></div></div>
          <div className="point-total"><span className="point-number" data-testid={`text-points-${student.id}`}>{student.points}</span><span className="point-word">P</span></div>
          <div className="point-actions" onClick={(event) => event.stopPropagation()}>
            <button className="point-button positive" onClick={() => applyPoints([student], 10, '칭찬 포인트 지급')} data-testid={`button-add-point-${student.id}`}><Plus size={13} /> +10</button>
            <button className="point-button negative" onClick={() => applyPoints([student], -5, '포인트 차감')} data-testid={`button-remove-point-${student.id}`}><Minus size={13} /> -5</button>
            <button className="point-button custom" onClick={() => setDialog({ students: [student] })} data-testid={`button-custom-point-${student.id}`}>직접 기록하기</button>
          </div>
        </div>;
      })}
    </div> : <div className="empty-state"><Users size={28} /><strong>No students in this group yet.</strong><div>Choose another group to see the class.</div></div>}
    {dialog ? <PointDialog students={dialog.students} onClose={() => setDialog(null)} onApply={(amount, reason) => { applyPoints(dialog.students, amount, reason); setDialog(null); }} /> : null}
    <ToastStack messages={messages} />
  </>;
}

function PointDialog({ students, onClose, onApply }: { students: Student[]; onClose: () => void; onApply: (amount: number, reason: string) => void }) {
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState(quickReasons[0]);
  return <div className="dialog-scrim" role="dialog" aria-modal="true">
    <div className="dialog">
      <div className="dialog-header"><div><div className="eyebrow">칭찬 스탬프 기록</div><h2 className="dialog-title">{students.length === 1 ? students[0].name : `${students.length}명 학생`}</h2></div><button className="icon-button" onClick={onClose} aria-label="닫기" data-testid="button-close-point-dialog"><X size={18} /></button></div>
      <div className="form-stack">
        <div><label className="field-label">빠른 점수 선택</label><div className="quick-reasons"><button className="quick-reason" onClick={() => setAmount(10)}>+10점</button><button className="quick-reason" onClick={() => setAmount(5)}>+5점</button><button className="quick-reason" onClick={() => setAmount(-5)}>−5점</button></div></div>
        <div><label className="field-label" htmlFor="point-amount">직접 입력</label><input id="point-amount" type="number" className="input" value={amount} onChange={(event) => setAmount(Number(event.target.value))} data-testid="input-point-amount" placeholder="예: 10 또는 -5" /></div>
        <div><label className="field-label" htmlFor="point-reason">사유</label><input id="point-reason" className="input" value={reason} onChange={(event) => setReason(event.target.value)} data-testid="input-point-reason" placeholder="칭찬 사유를 입력하세요" /><div className="quick-reasons">{quickReasons.map((item) => <button className="quick-reason" key={item} onClick={() => setReason(item)} data-testid={`button-reason-${item}`}>{item}</button>)}</div></div>
      </div>
      <div className="dialog-footer"><button className="secondary-button" onClick={onClose} data-testid="button-cancel-point">취소</button><button className="primary-button" onClick={() => onApply(amount, reason || '칭찬 포인트 지급')} data-testid="button-save-point"><Sparkles size={16} />기록 저장</button></div>
    </div>
  </div>;
}

function ShopPage() {
  const state = useClassroom();
  const [studentId, setStudentId] = useState(state.students[0]?.id ?? '');
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const [success, setSuccess] = useState<Reward | null>(null);
  const student = state.students.find((item) => item.id === studentId) ?? state.students[0];
  const pendingForStudent = state.redemptions.filter((item) => item.studentId === student?.id && item.status === 'pending').map((item) => item.rewardId);
  const showToast = (text: string) => {
    const id = Date.now();
    setMessages((current) => [...current, { id, text }]);
    window.setTimeout(() => setMessages((current) => current.filter((item) => item.id !== id)), 2600);
  };
  return <>
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">원하는 보상을 골라요</h2><p className="panel-copy">포인트를 모아 교실에서 사용할 수 있어요.</p></div><div className="eyebrow">{state.rewards.length}개 보상</div></div>
        {student ? <div className="shop-balance"><div><div className="field-label" style={{ color: '#4a8264', marginBottom: 3 }}>현재 잔여 포인트</div><div className="balance-value" data-testid="text-shop-balance">{student.points}P</div></div><Star size={28} /></div> : null}
        <div className="reward-grid">
          {state.rewards.map((reward, index) => {
            const canAfford = Boolean(student && student.points >= reward.cost);
            const requested = pendingForStudent.includes(reward.id);
            return <div className="reward-card" style={{ animationDelay: `${index * 35}ms` }} key={reward.id} data-testid={`card-reward-${reward.id}`}>
              <div className="reward-icon">{rewardIcon(reward.icon)}</div><div style={{ minWidth: 0 }}><div className="reward-title">{reward.title}</div><div className="reward-cost">{reward.cost}P 필요</div></div>
              <button className="secondary-button" disabled={!canAfford || requested} onClick={async () => { if (student && await classroomData.requestRedemption(student.id, reward.id)) setSuccess(reward); else showToast('포인트가 조금 더 필요해요.'); }} data-testid={`button-request-${reward.id}`}>{requested ? '신청 완료' : canAfford ? '신청하기' : '부족해요'}</button>
            </div>;
          })}
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">학생 선택</h2><p className="panel-copy">학생을 선택한 뒤 보상을 신청하세요.</p></div><Users size={18} color="#2b858b" /></div>
        <div className="form-stack">
          <div><label className="field-label" htmlFor="shop-student">학생</label><select className="student-select" id="shop-student" value={studentId} onChange={(event) => setStudentId(event.target.value)} data-testid="select-shop-student">{state.students.map((item) => <option value={item.id} key={item.id}>{item.number}번 {item.name} · {item.points}P</option>)}</select></div>
          {student ? <div><div className="field-label">보상까지 모으는 중</div><div className="progress-line"><div className="progress-fill" style={{ width: `${Math.min(100, (student.points / 100) * 100)}%` }} /></div><p className="panel-copy">{student.points >= 100 ? '상점의 모든 보상을 신청할 수 있어요.' : `${100 - student.points}P 더 모으면 가장 큰 보상에 도전할 수 있어요.`}</p></div> : null}
          <div className="empty-state" style={{ padding: '28px 15px' }}><CircleHelp size={24} /><strong>신청 후 선생님이 승인해요</strong><div>승인되기 전에는 포인트가 차감되지 않아요.</div></div>
        </div>
      </section>
    </div>
    {success ? <div className="dialog-scrim" role="dialog" aria-modal="true"><div className="dialog success-card"><div className="success-icon"><Check size={29} /></div><div className="eyebrow">신청 완료</div><h2 className="dialog-title" style={{ marginTop: 6 }}>멋진 선택이에요.</h2><p className="page-intro"><strong>{success.title}</strong> 신청을 선생님께 보냈어요.</p><button className="primary-button" onClick={() => setSuccess(null)} data-testid="button-close-success">상점으로 돌아가기</button></div></div> : null}
    <ToastStack messages={messages} />
  </>;
}

function ApprovalsPage() {
  const state = useClassroom();
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([]);
  const pending = state.redemptions.filter((item) => item.status === 'pending');
  const decided = state.redemptions.filter((item) => item.status !== 'pending');
  const decide = async (redemption: Redemption, status: 'approved' | 'rejected') => {
    if (await classroomData.decideRedemption(redemption.id, status)) {
      const id = Date.now();
      setMessages((current) => [...current, { id, text: status === 'approved' ? `${redemption.rewardTitle} 승인 완료` : '신청을 반려했어요' }]);
      window.setTimeout(() => setMessages((current) => current.filter((item) => item.id !== id)), 2600);
    }
  };
  return <>
    <div className="section-heading" style={{ marginTop: 0 }}><div><h2>보상 신청을 확인해요</h2><p>학생들의 신청을 확인하고 승인 또는 반려할 수 있어요.</p></div><span className="status-pill status-pending"><Clock3 size={12} />{pending.length}건 대기</span></div>
    <section className="panel">
      {pending.length ? pending.map((redemption) => <div className="redemption-row" key={redemption.id} data-testid={`row-pending-${redemption.id}`}>
        <div className="redemption-student"><div className="mini-avatar">{initials(redemption.studentName)}</div><div><div className="redemption-name">{redemption.studentName}</div><div className="redemption-meta">{formatTime(redemption.requestedAt)} · {redemption.cost} points</div></div></div>
        <div><div className="redemption-name">{redemption.rewardTitle}</div><div className="redemption-meta">상점 보상 신청 · {redemption.cost}P</div></div>
        <div className="row-actions"><button className="small-action reject" onClick={() => void decide(redemption, 'rejected')} data-testid={`button-reject-${redemption.id}`}><XCircle size={14} />반려</button><button className="small-action approve" onClick={() => void decide(redemption, 'approved')} data-testid={`button-approve-${redemption.id}`}><Check size={14} />승인</button></div>
      </div>) : <div className="empty-state"><CheckCircle2 size={29} /><strong>Everything is caught up.</strong><div>New reward requests will appear here.</div></div>}
    </section>
    <div className="section-heading"><div><h2>최근 처리한 신청</h2><p>이미 결정한 보상 신청을 확인할 수 있어요.</p></div></div>
    <section className="panel">
      {decided.slice(0, 5).map((redemption) => <div className="redemption-row" key={redemption.id}><div className="redemption-student"><div className="mini-avatar">{initials(redemption.studentName)}</div><div><div className="redemption-name">{redemption.studentName}</div><div className="redemption-meta">{redemption.rewardTitle} · {formatDate(redemption.requestedAt)}</div></div></div><span className={`status-pill status-${redemption.status}`}>{redemption.status === 'approved' ? <Check size={12} /> : <X size={12} />}{redemption.status}</span><div /></div>)}
      {!decided.length ? <div className="empty-state">아직 처리한 신청이 없어요.</div> : null}
    </section>
    <ToastStack messages={messages} />
  </>;
}

function HistoryPage() {
  const state = useClassroom();
  const [studentFilter, setStudentFilter] = useState('all');
  const transactions = state.transactions.filter((item) => studentFilter === 'all' || item.studentId === studentFilter);
  const exportCsv = () => {
    const rows = [['Date', 'Student', 'Amount', 'Reason'], ...transactions.map((item) => [new Date(item.timestamp).toISOString(), item.studentName, String(item.amount), item.reason])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'bright-ledger-history.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <>
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-header" style={{ marginBottom: 0 }}><div><h2 className="panel-title">Every point has a story</h2><p className="panel-copy">A transparent trail for teacher notes and family conversations.</p></div><div className="top-actions"><select className="student-select" style={{ width: 185, minHeight: 40 }} value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)} aria-label="Filter history by student" data-testid="select-history-student"><option value="all">All students</option>{state.students.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select><button className="primary-button" onClick={exportCsv} data-testid="button-export-csv"><Download size={16} />Export CSV</button></div></div>
    </div>
    <section className="panel">
      {transactions.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Student</th><th>Change</th><th>Reason</th><th>Date</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id} data-testid={`row-transaction-${transaction.id}`}><td><div className="redemption-student"><div className="mini-avatar">{initials(transaction.studentName)}</div><strong>{transaction.studentName}</strong></div></td><td className={transaction.amount > 0 ? 'amount-positive' : 'amount-negative'}>{transaction.amount > 0 ? '+' : ''}{transaction.amount} pts</td><td><span className="reason-tag">{transaction.reason}</span></td><td style={{ color: 'hsl(var(--muted-foreground))' }}>{formatDate(transaction.timestamp)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><History size={28} /><strong>No point changes yet.</strong><div>Your class story will start here.</div></div>}
    </section>
  </>;
}

function Router() {
  const state = useClassroom();
  return <AppShell pendingCount={state.redemptions.filter((item) => item.status === 'pending').length}>
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/approvals" component={ApprovalsPage} />
      <Route path="/history" component={HistoryPage} />
      <Route component={NotFound} />
    </Switch>
  </AppShell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><Router /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;