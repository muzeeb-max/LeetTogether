# LeetTogether — Real-Time Collaborative Coding Platform

LeetTogether is a production-grade full-stack real-time collaborative coding platform. Developers can team up inside collaborative workspaces, write code in a synchronized Monaco Editor, chat in real time, and run/submit solutions via the integrated Judge0 execution API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js, Vite, Tailwind CSS, Monaco Editor, Socket.IO Client |
| **Backend** | Node.js, Express.js, Socket.IO, JWT Auth, bcrypt |
| **Database** | **MySQL 8.0** via **Sequelize ORM** |
| **Code Execution** | Judge0 API (RapidAPI or self-hosted) |
| **Deployment** | Docker, Docker Compose |

---

## Database Architecture (MySQL + Sequelize)

The relational schema uses the following tables auto-created by Sequelize `sync({ alter: true })`:

| Table | Description |
|---|---|
| `Users` | Accounts, hashed passwords, stats, online status |
| `Friendships` | Self-referential many-to-many join table for friends |
| `FriendRequests` | Pending/accepted/rejected friend requests |
| `Problems` | Challenges with JSON columns for starter code, test cases |
| `Rooms` | Collaborative workspaces |
| `RoomParticipants` | Many-to-many join: users ↔ rooms |
| `Messages` | Room chat history & system events |
| `Notifications` | Real-time alerts (friend requests, invitations) |
| `Sessions` | Coding session analytics per user |

> **No migrations needed** — Sequelize will auto-create and alter tables when the server starts.

---

## Local Development Setup

### Prerequisites
- Node.js v18+
- MySQL 8.0 running locally on port `3306`
- Docker (optional, for containerized setup)

### Step 1: Configure Environment Variables

Create a `.env` file inside `/backend` based on `.env.example`:

```env
PORT=5000
NODE_ENV=development

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=secret_password
DB_NAME=leettogether

# JWT
JWT_SECRET=super_secret_secure_key_for_leettogether_jwt_auth_12345
JWT_EXPIRE=24h

# Judge0 (RapidAPI key or self-hosted)
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here
JUDGE0_IS_RAPIDAPI=true

# Frontend CORS
FRONTEND_URL=http://localhost:5173
```

> **Get a free Judge0 key** at [RapidAPI Judge0](https://rapidapi.com/judge0-official/api/judge0-ce/). Without a key, code execution will return errors.

### Step 2: Create MySQL Database

Connect to your local MySQL instance and create the database:

```sql
CREATE DATABASE IF NOT EXISTS leettogether;
```

> **Note:** Sequelize will automatically create all tables when the backend server starts. You do **not** need to run any SQL migration scripts manually.

### Step 3: Install Backend Dependencies & Seed

```bash
cd backend
npm install
npm run seed
```

The seed script will:
1. Connect to MySQL via Sequelize
2. Sync all table schemas
3. Insert 3 starter problems: **Two Sum**, **Palindrome Number**, **Valid Parentheses**

### Step 4: Start the Backend Server

```bash
npm run dev
```

The server will:
- Connect to MySQL
- Sync all Sequelize models (auto-create tables)
- Start HTTP + WebSocket server on `http://localhost:5000`

### Step 5: Install Frontend & Start Dev Server

```bash
cd frontend
npm install
npm run dev
```

Navigate to **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Docker Compose Deployment

Build and run the entire stack (Frontend + Backend + MySQL) in containers:

```bash
docker-compose up --build
```

Services:
- **Frontend (Nginx)**: [http://localhost](http://localhost) (Port 80)
- **Backend API**: [http://localhost:5000](http://localhost:5000) (Port 5000)
- **MySQL**: `localhost:3306` (database: `leettogether`)

> The `backend` service waits for the `mysql` service health check to pass before starting, preventing connection errors on cold boot.

After containers start, seed the database:

```bash
docker exec leettogether-api node src/seed/problems.js
```

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login and get JWT | Public |
| GET | `/api/auth/me` | Get current session user | ✅ |
| GET | `/api/users/profile/:username` | Get user profile + stats | ✅ |
| GET | `/api/users/search?username=` | Search users | ✅ |
| GET | `/api/friends` | Get friends list | ✅ |
| GET | `/api/friends/requests` | Get friend requests | ✅ |
| POST | `/api/friends/request` | Send friend request | ✅ |
| PUT | `/api/friends/request/:id` | Accept/Reject request | ✅ |
| DELETE | `/api/friends/:id` | Remove friend | ✅ |
| GET | `/api/problems` | List all problems | ✅ |
| GET | `/api/problems/:idOrSlug` | Get single problem | ✅ |
| POST | `/api/problems` | Create custom problem | ✅ |
| POST | `/api/execution/run` | Run code via Judge0 | ✅ |
| POST | `/api/execution/submit` | Submit & evaluate solution | ✅ |

---

## Socket.IO Events

| Event | Direction | Description |
|---|---|---|
| `room:join` | Client → Server | Join a collaborative room |
| `room:leave` | Client → Server | Leave the current room |
| `room:kick` | Client → Server | Host removes a participant |
| `room:change-problem` | Client → Server | Host switches the challenge |
| `room:change-language` | Client → Server | Host switches language |
| `room:sync-state` | Server → Client | Full room state sync |
| `room:user-joined` | Server → Room | Peer joined notification |
| `room:user-left` | Server → Room | Peer left notification |
| `editor:code-change` | Bidirectional | Sync code edits |
| `editor:cursor-change` | Bidirectional | Sync cursor positions |
| `editor:typing` | Client → Room | Typing presence indicator |
| `chat:message` | Bidirectional | Real-time chat |
| `invite:send` | Client → Server | Send room invitation |
| `invite:received` | Server → Client | Receive room invitation |
| `friend:status-change` | Server → Client | Friend online/offline update |

---

## Security

- **Helmet** — Secure HTTP headers (XSS, CSP, HSTS)
- **CORS** — Restricts to trusted frontend origin only
- **Rate Limiting** — Auth routes: 100/15min | Execution: 30/1min | General: 500/15min
- **bcrypt** — Password hashing with 10 salt rounds
- **JWT** — Signed tokens with configurable expiry

---

## Project Structure

```
leettogether/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/
│       │   ├── db.js          # Sequelize MySQL connection
│       │   └── security.js    # CORS, rate limiters
│       ├── models/
│       │   ├── index.js       # All associations defined here
│       │   ├── User.js
│       │   ├── FriendRequest.js
│       │   ├── Problem.js
│       │   ├── Room.js
│       │   ├── Message.js
│       │   ├── Notification.js
│       │   └── Session.js
│       ├── controllers/
│       ├── routes/
│       ├── middleware/
│       ├── sockets/
│       └── seed/
│           └── problems.js
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── context/
        ├── hooks/
        ├── components/
        ├── pages/
        └── services/
```
