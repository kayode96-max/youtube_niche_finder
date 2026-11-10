# SIGNAL v2 — YouTube Niche Scouting Platform

SIGNAL v2 is a modern, high-performance, full-stack web application designed for content creators and marketing analysts to scout YouTube niches, organize bookmarks, analyze channel performance, and leverage Gemini-powered AI agents for strategic content planning.

By separating frontend and backend duties, SIGNAL v2 implements a strict **single-origin security model** where API keys reside solely on the server. The frontend client never handles, exposes, or makes direct requests to third-party endpoints (YouTube Data API or Google Gemini).

---

## 🏗️ Architecture Overview

The project is structured as a monorepo consisting of two primary packages:

1. **Frontend (`/client`)**
   - Built with **React** and **Vite**.
   - Premium, custom-styled dark mode UI (`client/src/styles.css`) utilizing modern animations, custom scrollbars, and card layouts.
   - Proxies `/api` requests to the Express server during development to ensure single-origin security.
   - Compiled production build serves statically from the backend.

2. **Backend (`/server`)**
   - Built with **Node.js** and **Express**.
   - Proxies all requests to the **YouTube Data API v3** and **Google Gemini API**.
   - Integrates **better-sqlite3** as a high-performance, synchronous SQLite caching layer and bookmark store.
   - Automatically initializes database directories and schema objects on startup.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (Version 18.x or higher recommended for ESM, `--watch`, and modern features)
- [npm](https://www.npmjs.com/) (installed automatically with Node.js)

---

## 🚀 Getting Started

Follow these steps to configure and launch the application:

### Step 1: Install Dependencies
From the project root directory (`Youtube system`), run:
```bash
npm install
```
> [!NOTE]
> A `postinstall` script in the root [package.json](file:///c:/Users/Owner/Documents/August/Youtube%20system/package.json) will automatically install dependency packages for both `/client` and `/server`.

### Step 2: Configure Environment Variables
1. Make a copy of the `.env.example` template at the project root and name it `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file and input your credentials:
   ```env
   # YouTube Data API v3 key (Google Cloud Console → Credentials)
   YOUTUBE_API_KEY=your_youtube_api_key_here

   # Google Gemini API key (aistudio.google.com/apikey)
   GEMINI_API_KEY=your_gemini_api_key_here

   # Gemini model for the agent features. Defaults to gemini-2.5-flash
   GEMINI_MODEL=gemini-3.5-flash

   # SQLite database path (relative to /server or absolute)
   DATABASE_URL=./data/signal.sqlite

   # Port the Express API server listens on
   PORT=3000

   # How long cached YouTube responses stay fresh, in hours
   CACHE_TTL_HOURS=6

   # Per-session daily cap on AI agent calls (cost guardrail)
   AGENT_DAILY_CAP=40
   ```

---

## 💻 Running the Application

SIGNAL v2 supports both unified development and production-ready serving.

### Option A: Development Mode (Concurrent Server & Frontend)
To run both the backend server (with file watching) and the Vite frontend dev server simultaneously, run from the project root:
```bash
npm run dev
```
* **Frontend Hot Reloading:** http://localhost:5173
* **Backend API server:** http://localhost:3000 (Vite automatically proxies `/api` calls here)

### Option B: Production Mode (Single Origin Deployment)
To bundle the frontend application and run the Express app as a unified production server, execute:
```bash
# 1. Build the production assets for the React client
npm run build

# 2. Start the Express server
npm start
```
* **Unified Web App URL:** http://localhost:3000
* In this configuration, the Express server statically serves the built SPA from `/client/dist` and fallback-routes any non-API GET request to `index.html` to support client-side routing.

---

## 📦 Project Directory Layout

```text
Youtube system/
├── client/                 # React frontend application
│   ├── dist/               # Production assets build directory (generated)
│   ├── src/
│   │   ├── components/     # Modals, list widgets, and shared components
│   │   ├── hooks/          # Custom hooks (e.g., useBookmarks)
│   │   ├── lib/            # Axios API wrappers
│   │   ├── styles/         # Layout modules and typography
│   │   ├── views/          # Main sections: Scout, Bookmarks, Analytics, AI Scout
│   │   ├── App.jsx         # App router and layout coordinator
│   │   └── main.jsx        # App mount entry point
│   ├── vite.config.js      # Dev server port routing and reverse proxy
│   └── package.json
│
├── server/                 # Express backend server
│   ├── data/               # Persistent database storage directory (generated)
│   ├── src/
│   │   ├── config.js       # Environment configuration and schema mapping
│   │   ├── db.js           # Database setup and schema generation
│   │   ├── index.js        # Express application mount and main listener
│   │   ├── lib/            # Google Gemini and YouTube Data API client modules
│   │   └── routes/         # Endpoints for search, bookmarks, analytics, agent
│   └── package.json
│
├── .env                    # Active local environment variables (Gitignored)
├── .env.example            # Environment variables configuration template
├── package.json            # Main workspace coordinator config
└── README.md               # This project documentation
```

---

## 🗄️ Database & Schema Design

The application uses SQLite via `better-sqlite3` to store active configs, bookmark settings, and cache YouTube query results. The database file location defaults to `server/data/signal.sqlite` and is automatically created and schema-provisioned on startup.

The schema comprises:
* **`channels_cache`**: Caches channel profiles and subscriber analytics payload JSON with timestamps.
* **`videos_cache`**: Caches video detail payloads per video ID.
* **`api_cache`**: Caches generic API searches and playlist queries to conserve YouTube API quota.
* **`bookmark_folders`**: Stores folder structures for organizing bookmarks.
* **`bookmarks`**: Manages bookmark references of types `channel` and `video` linked to folders, storing user metadata notes and denormalized snapshots.
* **`agent_query_log`**: Tracks AI token usage (`input_tokens`, `output_tokens`) and action queries (`scout`, `analyze`, `plan`) for daily cap enforcement and analytics.

---

## 🔌 API Route Reference

All routes are nested under the `/api` prefix.

| Method | Route | Description |
| :--- | :--- | :--- |
| **GET** | `/api/health` | Diagnostic endpoint checking status of API key connections and configurations. |
| **GET** | `/api/search` | Performs text-based queries on YouTube channels. |
| **GET** | `/api/channels/:id` | Obtains details for a specific YouTube channel. Uses local cache if fresh. |
| **GET** | `/api/channels/:id/videos` | Fetches recent uploads from a specific channel. |
| **GET** | `/api/videos/:id` | Fetches details and metadata of specific videos. |
| **GET** | `/api/bookmarks/folders` | Retrieves, creates, or deletes user folders. |
| **GET** | `/api/bookmarks` | Returns all bookmarked channels and videos. |
| **POST** | `/api/bookmarks` | Bookmarks a new channel or video, specifying the target ID and metadata. |
| **DELETE**| `/api/bookmarks/:id` | Removes an item from the bookmarks. |
| **GET** | `/api/analytics/compare` | Compares aggregate performance across selected channels. |
| **POST** | `/api/agent/query` | Submits scout, analysis, or strategic planning prompts to the Gemini model. |

---

## 💡 Quota & Cost Protection

1. **Caching (YouTube API):** YouTube Data API calls consume quota (10,000 unit daily limit). The server stores API responses in the SQLite database and checks against `CACHE_TTL_HOURS` before calling Google Cloud again.
2. **AI Tokens Guardrail:** The Gemini AI model queries are audited using the `agent_query_log` table. Requests are capped at the specified `AGENT_DAILY_CAP` (default 40 queries/day) to prevent runaway costs.
