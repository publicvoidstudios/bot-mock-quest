# ASSIGN-o-BOT server

## Setup

**1. Install dependencies.**
```sh
npm install
```
**2. Setup PostgreSQL database.**

Following commands require psql to be installed on your local machine.

CREATE DATABASE:
```sql
CREATE DATABASE assignobot;
```
ENTER DATABASE:
```sql
\c assignobot
```
CREATE TABLE USERS:
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'user',
    hashed_password TEXT NOT NULL,
    messages JSONB[],
    tasks JSONB[] DEFAULT NULL
);
```
CREATE TABLE TASKS:
```sql
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
```
**3. Run server.**
```sh
npm run dev
```

# **API Documentation:**

## POST /api/v1/post/user

**Description**: This endpoint is used to register a new user.

**Request**:
- Method: POST
- URL: /api/v1/post/user
- Body: JSON object with the following fields:
    - `username` (string): The username of the new user.
    - `role` (string): The role of the new user (e.g., 'frontend', 'backend', 'fullstack', 'designer', 'qa', 'admin').
    - `hashed_password` (string): The hashed password of the new user.

**Response**:
- 200 OK: Successfully registered user.
- 400 Bad Request: Missing or invalid data.
- 500 Internal Server Error: Failed to register user.

## POST /api/v1/post/task

**Description**: This endpoint is used to create and assign a new task to users based on their roles.

**Request**:
- Method: POST
- URL: /api/v1/post/task
- Body: JSON object with the following fields:
    - `name` (string): The name of the task.
    - `description` (string): The description of the task.
    - `roles` (array of string): The roles that are eligible to perform the task.
    - `author_id` (number): The ID of the user who created the task.
    - `timeout` (number): The timeout in milliseconds for the task.

**Response**:
- 200 OK: Successfully registered task and sent messages to eligible users.
- 400 Bad Request: Please enter valid data or no matching users found.
- 500 Internal Server Error: Failed to register task or fetch users.

## GET /api/v1/get/users

**Description**: This endpoint is used to fetch all users from the database.

**Request**:
- Method: GET
- URL: /api/v1/get/users

**Response**:
- 200 OK: Returns a JSON array of all users.
- 500 Internal Server Error: Failed to fetch users.

## GET /api/v1/get/tasks

**Description**: This endpoint is used to fetch all tasks from the database.

**Request**:
- Method: GET
- URL: /api/v1/get/tasks

**Response**:
- 200 OK: Returns a JSON array of all tasks.
- 500 Internal Server Error: Failed to fetch tasks.

## PUT /api/v1/put/tasks

**Description**: This endpoint is used to perform actions on tasks (e.g., accept, decline, postpone).

**Request**:
- Method: PUT
- URL: /api/v1/put/tasks
- Body: JSON object with the following fields:
    - `user_id` (number): ID of the user performing the action.
    - `task_id` (number): ID of the task on which the action is being performed.
    - `action` (string): The action to be performed on the task ('accept', 'decline', 'postpone').

**Response**:
- 200 OK: Task action performed successfully.
- 400 Bad Request: Missing required field or something went wrong with the action.
- 500 Internal Server Error: Failed to perform the task action.