import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Automatically append JWT authorization token if available in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Redirect to login or handle unauthorized states automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear credentials if token expired
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // If we are not already on login, redirect to home/login
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
};

export const userAPI = {
  getProfile: (username) => api.get(`/users/profile/${username}`),
  searchUsers: (username) => api.get(`/users/search?username=${username}`)
};

export const friendAPI = {
  getFriends: () => api.get('/friends'),
  getFriendRequests: () => api.get('/friends/requests'),
  sendRequest: (username) => api.post('/friends/request', { username }),
  respondRequest: (requestId, action) => api.put(`/friends/request/${requestId}`, { action }),
  removeFriend: (friendId) => api.delete(`/friends/${friendId}`)
};

export const problemAPI = {
  getProblems: (difficulty = '', search = '') => {
    let url = '/problems?';
    if (difficulty) url += `difficulty=${difficulty}&`;
    if (search) url += `search=${search}`;
    return api.get(url);
  },
  getProblem: (idOrSlug) => api.get(`/problems/${idOrSlug}`)
};

export const executionAPI = {
  runCode: (code, language, customInput = '', problemId = null) => {
    return api.post('/execution/run', { code, language, customInput, problemId });
  },
  submitCode: (code, language, problemId, roomName = 'Solo Room', timeSpentSeconds = 0) => {
    return api.post('/execution/submit', { code, language, problemId, roomName, timeSpentSeconds });
  }
};

export default api;
