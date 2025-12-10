DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'member'
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    start_time TEXT,
    end_time TEXT,
    created_by TEXT
);

-- Default Users
-- Admin (Pass: admin123)
INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');
-- Member (Pass: user123)
INSERT INTO users (username, password, role) VALUES ('user', 'user123', 'member');
