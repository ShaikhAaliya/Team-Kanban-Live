const db = require('./db');
const bcrypt = require('bcryptjs');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'member',
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 description TEXT DEFAULT '',
 owner_id INTEGER NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS project_members (
 project_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 role TEXT NOT NULL DEFAULT 'member',
 PRIMARY KEY(project_id,user_id),
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 project_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 description TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'todo',
 priority TEXT NOT NULL DEFAULT 'medium',
 assigned_to INTEGER,
 due_date TEXT,
 created_by INTEGER NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
 FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS task_tags (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id INTEGER NOT NULL,
 name TEXT NOT NULL,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS attachments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 original_name TEXT NOT NULL,
 stored_name TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 task_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 comment TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 project_id INTEGER,
 task_id INTEGER,
 message TEXT NOT NULL,
 is_read INTEGER NOT NULL DEFAULT 0,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS activity_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 project_id INTEGER NOT NULL,
 task_id INTEGER,
 user_id INTEGER NOT NULL,
 action TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
 FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const exists = db.prepare('SELECT id FROM users WHERE email=?').get('admin@kanban.local');
if (!exists) {
  const hash = bcrypt.hashSync('admin123', 10);
  const result = db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Project Admin','admin@kanban.local',hash,'admin');
  const project = db.prepare('INSERT INTO projects(name,description,owner_id) VALUES(?,?,?)').run('Demo Project','Sample project for Team Kanban Live.',result.lastInsertRowid);
  db.prepare('INSERT INTO project_members(project_id,user_id,role) VALUES(?,?,?)').run(project.lastInsertRowid,result.lastInsertRowid,'owner');
  db.prepare('INSERT INTO tasks(project_id,title,description,status,priority,assigned_to,created_by) VALUES(?,?,?,?,?,?,?)').run(project.lastInsertRowid,'Set up project','Initialize the college project.','todo','high',result.lastInsertRowid,result.lastInsertRowid);
  db.prepare('INSERT INTO tasks(project_id,title,description,status,priority,assigned_to,created_by) VALUES(?,?,?,?,?,?,?)').run(project.lastInsertRowid,'Design dashboard','Create the project dashboard UI.','in_progress','medium',result.lastInsertRowid,result.lastInsertRowid);
  db.prepare('INSERT INTO tasks(project_id,title,description,status,priority,assigned_to,created_by) VALUES(?,?,?,?,?,?,?)').run(project.lastInsertRowid,'Prepare testing','Create test cases for the first module.','done','low',result.lastInsertRowid,result.lastInsertRowid);
}
console.log('Database initialized.');
console.log('Demo login: admin@kanban.local / admin123');
