import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Calendar, Award, Code2, Clock, History, ChevronLeft } from 'lucide-react';
import { userAPI } from '../services/api';
import Navbar from '../components/Navbar';

const Profile = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await userAPI.getProfile(username);
        setProfile(res.data);
      } catch (err) {
        console.error('Failed to load profile:', err.message);
        setError('Failed to load user profile or user does not exist.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  const formatTime = (totalSeconds) => {
    if (!totalSeconds) return '0 min';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-center items-center">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin mb-4"></div>
        <p className="text-slate-450">Loading Developer Profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="bg-[#1E293B] border border-slate-800 p-8 rounded-2xl text-center max-w-md w-full">
          <p className="text-red-400 font-semibold text-lg mb-4">{error || 'User not found'}</p>
          <Link to="/" className="inline-flex items-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { stats } = profile;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-450 hover:text-white transition-colors mb-6 group">
          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> Back to Dashboard
        </Link>

        {/* User Card Header */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-8">
          <img
            src={profile.avatar}
            alt={profile.username}
            className="w-24 h-24 md:w-28 md:w-28 rounded-full border-2 border-slate-700 bg-slate-800"
          />
          <div className="flex-grow text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">{profile.username}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-400 mt-3.5">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Registered {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${profile.status === 'online' ? 'bg-green-500' : profile.status === 'in-room' ? 'bg-blue-500' : 'bg-slate-500'}`}></span>
                {profile.status === 'in-room' ? 'Coding in Room' : profile.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Breakdown */}
        <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-blue-400" /> Challenge Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 text-center">
            <p className="text-xs text-slate-450 font-bold uppercase tracking-wider mb-1">Solved Challenges</p>
            <p className="text-4xl font-extrabold text-blue-450">{stats.problemsSolved}</p>
          </div>
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 text-center border-l-4 border-l-green-500/50">
            <p className="text-xs text-green-400 font-bold uppercase tracking-wider mb-1">Easy Solved</p>
            <p className="text-4xl font-extrabold text-slate-100">{stats.easySolved}</p>
          </div>
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 text-center border-l-4 border-l-amber-500/50">
            <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mb-1">Medium Solved</p>
            <p className="text-4xl font-extrabold text-slate-100">{stats.mediumSolved}</p>
          </div>
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 text-center border-l-4 border-l-red-500/50">
            <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Hard Solved</p>
            <p className="text-4xl font-extrabold text-slate-100">{stats.hardSolved}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Coding Sessions</p>
              <p className="text-2xl font-bold text-slate-100">{stats.sessionsCreated || 0}</p>
            </div>
          </div>
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Coding Duration</p>
              <p className="text-2xl font-bold text-slate-100">{formatTime(stats.timeSpentCoding)}</p>
            </div>
          </div>
          <div className="bg-[#1E293B]/40 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Friend Connections</p>
              <p className="text-2xl font-bold text-slate-100">{profile.friends.length}</p>
            </div>
          </div>
        </div>

        {/* Recent Session History */}
        <h2 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2"><History className="w-5 h-5 text-slate-400" /> Recent Session History</h2>
        <div className="bg-[#1E293B]/30 border border-slate-800 rounded-2xl overflow-hidden">
          {profile.recentSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-650" />
              <p className="text-sm">No recent coding sessions logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="p-4">Problem</th>
                    <th className="p-4">Difficulty</th>
                    <th className="p-4">Language</th>
                    <th className="p-4">Workspace</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {profile.recentSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 font-semibold text-slate-250">
                        {session.problemSolved ? session.problemSolved.title : 'Custom Sandbox'}
                      </td>
                      <td className="p-4">
                        {session.problemSolved ? (
                          <span className={`inline-flex py-0.5 px-2 rounded-full text-xs font-semibold ${session.problemSolved.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' : session.problemSolved.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                            {session.problemSolved.difficulty.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-350">
                        {session.languageUsed.toUpperCase()}
                      </td>
                      <td className="p-4 text-slate-300">
                        {session.roomName}
                      </td>
                      <td className="p-4 text-slate-300">
                        {formatTime(session.timeSpentSeconds)}
                      </td>
                      <td className="p-4 text-slate-450">
                        {new Date(session.completedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
