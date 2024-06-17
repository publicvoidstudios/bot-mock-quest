CREATE DATABASE assignobot;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'user',
    hashed_password TEXT NOT NULL,
    messages JSONB[],
    tasks JSONB[] DEFAULT NULL
);

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    roles TEXT[],
    ask_later INT[],
    declined INT[] DEFAULT NULL,
    assigned_to INT DEFAULT NULL,
    author_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timeout INT NOT NULL
);
