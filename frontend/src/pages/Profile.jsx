import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Award, CalendarDays, Clock3, Code2, History, Sparkles, Users, Zap } from 'lucide-react';
import { userAPI } from '../services/api';
import Navbar from '../components/Navbar';
import { Avatar, DifficultyBadge, EmptyState, MetricCard, SectionHeading, Surface } from '../components/ui';

const formatTime = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
};

const Profile = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try { const response = await userAPI.getProfile(username); if (active) setProfile(response.data); }
      catch (err) { if (active) setError('This profile could not be loaded.'); }
      finally { if (active) setLoading(false); }
    };
    fetchProfile();
    return () => { active = false; };
  }, [username]);

  const sessions = profile?.recentSessions || [];
  const languageCounts = useMemo(() => sessions.reduce((counts, session) => {
    const language = session.languageUsed || 'Other';
    counts[language] = (counts[language] || 0) + 1;
    return counts;
  }, {}), [sessions]);
  const activeDays = useMemo(() => {
    const dates = new Set(sessions.map((session) => new Date(session.completedAt).toDateString()));
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (34 - index));
      const count = sessions.filter((session) => new Date(session.completedAt).toDateString() === date.toDateString()).length;
      return { date, count, active: dates.has(date.toDateString()) };
    });
  }, [sessions]);

  if (loading) return <div className="min-h-screen bg-[#09090B] text-zinc-100"><Navbar /><main className="page-shell py-12"><div className="h-52 animate-pulse rounded-[28px] bg-white/[0.04]" /><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map((n) => <div key={n} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div></main></div>;
  if (error || !profile) return <div className="min-h-screen bg-[#09090B] text-zinc-100"><Navbar /><main className="page-shell py-16"><Surface className="mx-auto max-w-lg"><EmptyState icon={Users} title="Profile unavailable" description={error || 'This member could not be found.'} action={<Link to="/" className="button-primary">Back to workspace</Link>} /></Surface></main></div>;

  const { stats = {} } = profile;
  const statusLabel = profile.status === 'in-room' ? 'Coding in a room' : profile.status === 'online' ? 'Online now' : 'Offline';
  const statusColor = profile.status === 'in-room' || profile.status === 'online' ? 'bg-emerald-400' : 'bg-zinc-600';
  const badges = [
    stats.problemsSolved >= 1 && { icon: Award, name: 'First solve', detail: 'Completed a challenge', tone: 'violet' },
    stats.sessionsCreated >= 1 && { icon: Users, name: 'Room host', detail: 'Started a coding room', tone: 'cyan' },
    stats.timeSpentCoding >= 3600 && { icon: Zap, name: 'Deep focus', detail: 'One hour of coding time', tone: 'amber' }
  ].filter(Boolean);

  return <div className="min-h-screen bg-[#09090B] text-zinc-100"><Navbar />
    <main className="page-shell space-y-8 py-8 sm:py-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> Workspace</Link>
      <section className="hero-panel relative overflow-hidden rounded-[28px] p-6 sm:p-9">
        <div className="pointer-events-none absolute -right-16 -top-32 h-80 w-80 rounded-full bg-violet-500/20 blur-[90px]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end">
          <Avatar src={profile.avatar} name={profile.username} size="lg" className="!h-24 !w-24 ring-4 ring-[#111113] sm:!h-28 sm:!w-28" />
          <div className="min-w-0 flex-1"><p className="eyebrow">Member profile</p><h1 className="mt-2 truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">{profile.username}</h1><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400"><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${statusColor}`} />{statusLabel}</span>{profile.createdAt && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>}</div></div>
          <div className="rounded-2xl border border-white/[0.08] bg-black/15 px-4 py-3"><p className="text-xs text-zinc-500">Connections</p><p className="mt-1 text-xl font-semibold text-white">{profile.friends?.length || 0}<span className="ml-1 text-xs font-normal text-zinc-500">friends</span></p></div>
        </div>
      </section>

      <section><SectionHeading eyebrow="Progress at a glance" title="The work adds up" description="A snapshot of challenges and time spent in the workspace." /><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Challenges solved" value={stats.problemsSolved ?? 0} detail="Across all difficulty levels" icon={Award} accent="violet" /><MetricCard label="Coding sessions" value={stats.sessionsCreated ?? 0} detail="Rooms started" icon={Code2} accent="cyan" /><MetricCard label="Time coding" value={formatTime(stats.timeSpentCoding)} detail="Recorded focus time" icon={Clock3} accent="green" /><MetricCard label="Friend connections" value={profile.friends?.length || 0} detail="People in your circle" icon={Users} accent="amber" /></div></section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
        <Surface className="p-5 sm:p-6"><SectionHeading eyebrow="Last 35 days" title="Activity pulse" description="Days with a recorded coding session are highlighted." /><div className="mt-6 grid grid-flow-col grid-rows-5 gap-1.5 sm:gap-2" role="img" aria-label="Recent coding activity over the last 35 days">{activeDays.map(({ date, count }, index) => <span key={index} title={`${date.toLocaleDateString()}: ${count} session${count === 1 ? '' : 's'}`} className={`aspect-square rounded-[4px] ${count ? count > 1 ? 'bg-violet-400' : 'bg-violet-400/55' : 'bg-white/[0.045]'}`} />)}</div><div className="mt-4 flex items-center justify-between text-[11px] text-zinc-600"><span>Less</span><div className="flex gap-1"><i className="h-2.5 w-2.5 rounded-sm bg-white/[0.045]"/><i className="h-2.5 w-2.5 rounded-sm bg-violet-400/30"/><i className="h-2.5 w-2.5 rounded-sm bg-violet-400/65"/><i className="h-2.5 w-2.5 rounded-sm bg-violet-400"/></div><span>More</span></div><p className="mt-4 text-xs text-zinc-600">Activity is based on the recent sessions available for this profile.</p></Surface>
        <Surface className="p-5 sm:p-6"><SectionHeading eyebrow="Your toolkit" title="Recent languages" description="Based on the coding sessions shown here." /><div className="mt-5 space-y-3">{Object.entries(languageCounts).length ? Object.entries(languageCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([language, count]) => <div key={language} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3.5 py-3"><span className="inline-flex items-center gap-2.5 text-sm text-zinc-200"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200"><Code2 className="h-4 w-4" /></span>{language}</span><span className="text-xs text-zinc-500">{count} session{count === 1 ? '' : 's'}</span></div>) : <EmptyState icon={Code2} title="Languages show up here" description="Start a session to build your activity profile." className="px-2 py-8" />}</div></Surface>
      </div>

      <section><SectionHeading eyebrow="Milestones" title="Achievements" description="Small wins gathered along the way." /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{badges.length ? badges.map(({ icon: Icon, name, detail, tone }) => <Surface key={name} className="interactive-card flex items-center gap-4 p-4"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tone === 'cyan' ? 'bg-cyan-300/10 text-cyan-200' : tone === 'amber' ? 'bg-amber-300/10 text-amber-200' : 'bg-violet-300/10 text-violet-200'}`}><Icon className="h-5 w-5" /></span><div><p className="text-sm font-medium text-zinc-200">{name}</p><p className="mt-1 text-xs text-zinc-600">{detail}</p></div></Surface>) : <Surface className="sm:col-span-2 lg:col-span-3"><EmptyState icon={Sparkles} title="Your first milestone is waiting" description="Solve a challenge or host a room to earn your first achievement." /></Surface>}</div></section>

      <section><SectionHeading eyebrow="The people you build with" title="Your circle" description="Friends connected to this profile." /><div className="mt-5">{profile.friends?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profile.friends.slice(0, 6).map((friend) => <Link key={friend.id} to={`/profile/${friend.username}`} className="interactive-card flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#141418] p-4"><Avatar src={friend.avatar} name={friend.username} size="md" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-200">{friend.username}</p><p className="mt-1 text-xs text-zinc-600">{friend.status === 'in-room' ? 'Coding in a room' : friend.status === 'online' ? 'Online now' : 'Offline'}</p></div><span className={`h-2 w-2 rounded-full ${friend.status === 'online' || friend.status === 'in-room' ? 'bg-emerald-400' : 'bg-zinc-700'}`} /></Link>)}</div> : <Surface><EmptyState icon={Users} title="A circle of collaborators" description="Friend connections will appear here as they grow." /></Surface>}</div></section>

      <section><SectionHeading eyebrow="Keep the momentum" title="Recent sessions" description="The latest coding rooms recorded on this profile." /><Surface className="mt-5 overflow-hidden p-2">{sessions.length === 0 ? <EmptyState icon={History} title="No sessions yet" description="When this member codes, their recent sessions will appear here." /> : <div className="grid gap-2 md:grid-cols-2">{sessions.slice(0,8).map((session) => <article key={session.id} className="interactive-card rounded-xl border border-white/[0.05] bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-200">{session.problemSolved?.title || session.roomName || 'Coding session'}</p><p className="mt-1 truncate text-xs text-zinc-600">{session.roomName || 'Personal workspace'}</p></div>{session.problemSolved?.difficulty && <DifficultyBadge difficulty={session.problemSolved.difficulty} />}</div><div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{session.languageUsed || 'Workspace'} · {formatTime(session.timeSpentSeconds)}</span><span>{new Date(session.completedAt).toLocaleDateString()}</span></div></article>)}</div>}</Surface></section>
    </main>
  </div>;
};

export default Profile;
