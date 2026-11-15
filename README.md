# Team Kanban Live — Milestone 4

College final-year project: a modern light-theme, real-time team task and project management system.

## Stack
- Node.js + Express.js
- EJS
- SQLite via better-sqlite3
- Socket.IO
- Express Session + SQLite session store
- Multer for task attachments
- Vanilla JavaScript/CSS

## Features included
- Signup/login/logout
- Projects and project membership
- Kanban board: To Do, In Progress, Review, Done
- Drag-and-drop task status updates
- Real-time project room updates with Socket.IO
- Task assignment, priorities and due dates
- Task comments and activity history
- In-app notifications
- Admin dashboard and analytics
- User/project/task administration
- Task tags
- Task attachments (5 MB per file)
- Project calendar view
- Task search and status/priority filters
- User profile and task summary
- Responsive modern light UI

## Setup in VS Code / Windows

```bash
cd Team-Kanban-Live
npm install
npm run init-db
npm start
```

Open `http://localhost:3000`.

Demo admin:
- Email: `admin@kanban.local`
- Password: `admin123`

## Important
The build environment used to prepare this ZIP could not complete `npm install` because package installation timed out. Run `npm install` locally before starting the application. The JavaScript files were syntax-checked successfully.

Uploaded files are stored in `public/uploads/` and are limited to 5 MB per file.
