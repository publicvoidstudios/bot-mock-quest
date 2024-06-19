import express from "express";
import cors from 'cors';
import knex from 'knex';
const app = express();
const port = process.env.PORT || 3000;
const db = knex({
    client: 'pg', //PostgreSQL
    connection: {
        host: "127.0.0.1",
        user: "postgres",
        password: "master96",
        port: 5432,
        database: "assignobot"
    }
});
// Middleware to enable CORS
app.use(cors());
// Middleware to parse incoming JSON data
app.use(express.json());
class Task {
    id;
    name;
    description;
    roles;
    ask_later;
    declined;
    assigned_to;
    author_id;
    created_at;
    timeout;
    constructor(id, name, description, roles, ask_later, declined, assigned_to, author_id, created_at, timeout) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.roles = roles;
        this.ask_later = ask_later;
        this.declined = declined;
        this.assigned_to = assigned_to;
        this.author_id = author_id;
        this.created_at = created_at;
        this.timeout = timeout;
    }
}
class User {
    id;
    nickname;
    role;
    hashed_password;
    messages;
    tasks;
    constructor(id, nickname, role, hashed_password, messages, tasks) {
        this.id = id;
        this.nickname = nickname;
        this.role = role;
        this.hashed_password = hashed_password;
        this.messages = messages;
        this.tasks = tasks;
        this.id = Date.now();
        this.messages = [];
        this.tasks = [];
    }
}
let users = [];
let tasks = [];
const finalTimeout = 2 * 60000; //1 minute final timeout before any task expiration
const getUnassignedTasks = async () => {
    let result = null;
    await db.select().from("tasks")
        .then(data => {
        result = data.filter(task => task.assigned_to === null);
    })
        .catch(err => {
        console.error(err);
    });
    return result;
};
function checkTaskTimeout(task) {
    const now = new Date().getTime();
    const createdAt = new Date(task.created_at).getTime();
    const diff = now - createdAt;
    return diff >= task.timeout;
}
const taskTotallyExpired = (task) => {
    const now = new Date().getTime();
    const createdAt = new Date(task.created_at).getTime();
    const expiresIn = (now - createdAt) - task.timeout;
    return expiresIn >= finalTimeout;
};
const sendMessage = async (user_id, message) => {
    let messages = [];
    await db('users')
        .where('id', user_id)
        .select('messages')
        .then(data => {
        if (data && data.length > 0) {
            messages = data[0].messages;
            messages.push(message);
        }
        else {
            console.log(`Failed to send message... ${data}`);
        }
    })
        .catch(err => {
        console.error(err);
    });
    await db('users')
        .where('id', user_id)
        .select('messages')
        .update('messages', messages)
        .then(data => {
        if (data) {
            console.log(`Message was sent to user ${user_id}!`);
        }
        else {
            console.log(`Failed to send message... ${data}`);
        }
    })
        .catch(err => {
        console.error(err);
    });
};
const removeTask = async (task) => {
    await db.del()
        .where("id", task.id)
        .from('tasks');
};
//Sends messages to all users that postponed task.
const askLater = async (task) => {
    if (task.ask_later !== null) {
        for (const user_id of task.ask_later) {
            await sendMessage(user_id, {
                id: Date.now(),
                author_id: -1,
                body: JSON.stringify(task),
                was_read: false,
                status: 'again'
            });
        }
        console.log(`Clearing task ask later queue:  ${task.name}`);
        await clearAskLater(task);
    }
    else {
        console.log(`No one to ask later...`);
        console.log(`Checking final timeout`);
        if (taskTotallyExpired(task)) {
            console.log(`Task: ${task.name} is completely expired...`);
            //Send message to author
            await sendMessage(task.author_id, {
                id: Date.now(),
                author_id: task.author_id,
                body: JSON.stringify(task),
                was_read: false,
                status: "failed"
            });
            console.log(`Sent warning message to task's author.`);
            //Remove task from db
            await removeTask(task);
            console.log(`Removed task: ${task.name}`);
        }
    }
};
//Clears list of users that postponed task.
const clearAskLater = async (task) => {
    if (task.ask_later !== null) {
        await db('tasks')
            .where('id', task.id)
            .select('ask_later')
            .update('ask_later', null)
            .then(data => {
            if (data) {
                console.log(`ask_later was nullified!`);
            }
            else {
                console.log(`Failed to nullify ask_later... ${data}`);
            }
        })
            .catch(err => {
            console.error(err);
        });
    }
};
//Checking for timeouts and asking users again if timeout reached.
const checkTasksTimeouts = async () => {
    if (tasks?.length) {
        for (const task of tasks) {
            if (checkTaskTimeout(task)) {
                console.log(`== ${Date.now()} FOUND EXPIRED TASK  ==`);
                console.log(task.name);
                console.log('initiating ask later sequence...');
                await askLater(task);
            }
            else {
                console.log(`no expired tasks...`);
            }
        }
    }
    else {
        console.log(`tasks empty`);
    }
};
const tasksCheckupInfiniteLoop = async (timeout) => {
    tasks = await getUnassignedTasks();
    await checkTasksTimeouts();
    setTimeout(() => {
        tasksCheckupInfiniteLoop(timeout);
    }, timeout);
};
tasksCheckupInfiniteLoop(3000);
app.post('/api/v1/post/user', (req, res) => {
    const { username, role, hashed_password } = req.body;
    if (!username || !role || !hashed_password) {
        return res.status(400).send({ message: 'Missing or invalid data' });
    }
    db('users').insert({
        hashed_password: hashed_password,
        role: role,
        username: username
    })
        .returning(["username", "role", "hashed_password"])
        .then(data => {
        if (data && data.length > 0) {
            console.log(`User registered`);
            return res.status(200).send({ message: 'Successfully registered user', data: data });
        }
        else {
            console.log(`Failed to register user`);
            return res.status(400).send({ message: 'Failed to register user' });
        }
    })
        .catch(err => {
        console.error(err);
        return res.status(500).send({ message: 'Failed to register user' });
    });
});
//A way to receive a new task
app.post("/api/v1/post/task", async (req, res) => {
    // Destructuring request body
    const { name, description, roles, author_id, timeout } = req.body;
    let statusCode = 0;
    let resMessage = '';
    if (!name || !description || !roles || !author_id) {
        return res.status(400).json({ message: 'Please enter valid data' });
    }
    let task = null;
    //Store task in database
    await db('tasks').insert({
        //Serial id is created automatically
        name: name,
        description: description,
        roles: roles,
        author_id: author_id,
        timeout: timeout
        //Initially task is assigned to null
    })
        .returning('*')
        .then(data => {
        if (data && data.length > 0) {
            task = data[0];
            statusCode = 200;
            resMessage += 'Successfully registered task. ';
        }
        else {
            statusCode = 400;
            resMessage += 'Failed to register task. ';
        }
    })
        .catch(err => {
        console.error(err);
    });
    // Get/refresh tasks list
    await db.select().from("tasks")
        .then(data => {
        tasks = data;
    })
        .catch(err => {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch tasks list' });
    });
    // GET/REFRESH USERS LIST
    await db.select().from('users')
        .then(data => {
        if (data && data.length > 0) {
            users = data;
            statusCode = 200;
            resMessage += 'Successfully refreshed users list. ';
        }
        else {
            statusCode = 400;
            resMessage += 'Failed to refresh users list. ';
        }
    })
        .catch(err => {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch users' });
    });
    const filteredUsers = filterUsers(task, users);
    if (filteredUsers.length > 0) {
        //Pool all users here
        for (const user of filteredUsers) {
            let messages = [];
            await db('users').where('id', user.id).select('messages')
                .then(data => {
                if (data && data.length > 0) {
                    messages = data[0].messages || [];
                    messages.push({
                        id: Date.now(),
                        body: JSON.stringify(task),
                        author_id: author_id,
                        was_read: false,
                        status: 'new'
                    });
                    statusCode = 200;
                    resMessage += 'Temporarily stored messages. ';
                }
                else {
                    statusCode = 400;
                    resMessage += 'Failed to temp store messages. ';
                }
            })
                .catch(err => {
                console.error(err);
            });
            await db('users')
                .where('id', user.id)
                .select('messages')
                .update('messages', messages)
                .then(data => {
                if (data) {
                    statusCode = 200;
                    resMessage += 'Pushed message to database. ';
                }
                else {
                    statusCode = 400;
                    resMessage += 'Failed to push message to database. ';
                }
            })
                .catch(err => {
                console.error(err);
            });
        }
        //By this point all messages were sent
        //Now set timer if no one answers.
    }
    else {
        //Check ask later logic here
        console.log(`No matching users found. Aborting...`);
        statusCode = 400;
        resMessage += 'No matching users found. ';
    }
    res.status(statusCode).send({ message: resMessage });
});
// Endpoint to fetch all users from the database
app.get('/api/v1/get/users', (req, res) => {
    db.select().from('users')
        .then(users => {
        res.status(200).send(users);
    })
        .catch(err => {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch users' });
    });
});
// Endpoint to fetch all tasks from the database
app.get('/api/v1/get/tasks', (req, res) => {
    db.select().from('tasks')
        .then(tasks => {
        res.status(200).send(tasks);
    })
        .catch(err => {
        console.error(err);
        res.status(500).send({ message: 'Failed to fetch tasks' });
    });
});
const assignTaskToUser = async (task_id, user_id) => {
    let task = null;
    await db("tasks")
        .where('id', task_id)
        .select()
        .then(tasks => {
        console.log(`ASSIGN TASK`);
        console.log(tasks[0]);
        task = tasks[0];
    });
    if (task.assigned_to === null) {
        task.assigned_to = user_id;
    }
    else {
        console.warn(`TASK ${task_id} IS ALREADY TAKEN`);
        return false;
    }
    let user_tasks = null;
    await db("users")
        .where('id', user_id)
        .select("tasks")
        .then(tasks => {
        if (tasks) {
            user_tasks = tasks[0]?.tasks || [];
            user_tasks.push(task);
        }
        else {
            console.log(`Failed to assign task... ${tasks}`);
        }
    })
        .catch(err => {
        console.error(err);
    });
    await db('users')
        .where('id', user_id)
        .select('tasks')
        .update('tasks', user_tasks)
        .then(data => {
        if (data) {
            console.log(`Task was added to user ${user_id}!`);
        }
        else {
            console.log(`Failed to add task to user... ${data}`);
        }
    })
        .catch(err => {
        console.error(err);
    });
    await db('tasks')
        .where('id', task_id)
        .select('assigned_to')
        .update('assigned_to', user_id)
        .then(data => {
        if (data) {
            console.log(`ASSIGNED TO user ${user_id}!`);
        }
        else {
            console.log(`Failed to update tasks table assigned to field of task ${task_id}!`);
        }
    })
        .catch(err => {
        console.error(err);
    });
    return true;
};
const declineTask = async (task_id, user_id) => {
    let task = null;
    await db("tasks")
        .where('id', task_id)
        .select()
        .then(tasks => {
        task = tasks[0];
        if (task.declined === null) {
            task.declined = [];
            task.declined.push(user_id);
        }
        else {
            task.declined.push(user_id);
        }
    });
    await db('tasks')
        .where('id', task_id)
        .select('declined')
        .update('declined', task.declined)
        .then(data => {
        if (data) {
            console.log(`USER ${user_id} DECLINED TASK ${task_id}!`);
        }
        else {
            console.log(`Failed to update tasks table DECLINED field of task ${task_id}!`);
        }
    })
        .catch(err => {
        console.error(err);
    });
    return true;
};
const postponeTask = async (task_id, user_id) => {
    let task = null;
    await db("tasks")
        .where('id', task_id)
        .select()
        .then(tasks => {
        task = tasks[0];
    });
    if (task.assigned_to !== null) {
        console.warn(`TASK ${task_id} IS ALREADY TAKEN`);
        return false;
    }
    else {
        if (task.ask_later !== null) {
            task.ask_later.push(user_id);
        }
        else {
            task.ask_later = [];
            task.ask_later.push(user_id);
        }
    }
    await db('tasks')
        .where('id', task_id)
        .select('ask_later')
        .update('ask_later', task.ask_later)
        .then(data => {
        if (data) {
            console.log(`User ${user_id} asked to ask him/her later!`);
        }
        else {
            console.log(`Failed to update tasks table ask_later field of task ${task_id}!`);
        }
    })
        .catch(err => {
        console.error(err);
    });
    return true;
};
const removeMessage = async (user_id, message_id) => {
    try {
        console.log(`Removing message: ${message_id} from user ${user_id}`);
        let messages = [];
        await db('users')
            .where('id', user_id)
            .select('messages')
            .then(data => {
            if (data && data.length > 0) {
                messages = data[0].messages;
                console.log('Current messages:');
                console.log(messages);
                messages = messages.filter(message => message.id !== message_id);
                console.log('Filtered messages:');
                console.log(messages);
            }
            else {
                console.log(`Failed to remove message... ${data}`);
            }
        })
            .catch(err => {
            console.error(err);
        });
        await db('users')
            .where('id', user_id)
            .select('messages')
            .update('messages', messages)
            .then(data => {
            if (data) {
                console.log(`Message was removed from user ${user_id}!`);
                console.log(data);
            }
            else {
                console.log(`Failed to remove message... ${data}`);
            }
        })
            .catch(err => {
            console.error(err);
        });
    }
    catch (error) {
        console.error('An error occurred while removing the message:', error);
        return false;
    }
};
app.put("/api/v1/put/tasks", async (req, res) => {
    const { user_id, task_id, action, message_id } = req.body;
    if (!user_id || !task_id || !action) {
        return res.status(400).send({ message: 'Missing required field' });
    }
    switch (action) {
        case 'accept':
            const accept_result = await assignTaskToUser(task_id, user_id);
            if (accept_result) {
                //Remove message
                await removeMessage(user_id, message_id);
                return res.status(200).send({ message: 'Task accepted successfully' });
            }
            else {
                return res.status(400).send({ message: 'Something went wrong. Task not accepted' });
            }
        case 'decline':
            const decline_result = await declineTask(task_id, user_id);
            if (decline_result) {
                await removeMessage(user_id, message_id);
                return res.status(200).send({ message: 'Task declined successfully' });
            }
            else {
                return res.status(400).send({ message: 'Something went wrong. Task not declined' });
            }
        case 'postpone':
            const postpone_result = await postponeTask(task_id, user_id);
            if (postpone_result) {
                return res.status(200).send({ message: 'Task postponed successfully' });
            }
            else {
                return res.status(400).send({ message: 'Something went wrong. Task was not postponed' });
            }
    }
});
app.delete("/api/v1/delete/messages", async (req, res) => {
    const { user_id, message_id } = req.body;
    if (!user_id || !message_id) {
        if (!user_id && !message_id) {
            return res.status(400).send({ message: 'Missing both fields' });
        }
        if (!user_id && message_id) {
            return res.status(400).send({ message: 'Missing user_id' });
        }
        if (user_id && !message_id) {
            return res.status(400).send({ message: 'Missing message_id' });
        }
        return res.status(400).send({ message: 'Missing required field' });
    }
    try {
        await removeMessage(user_id, message_id);
        return res.status(200).send({ message: 'Message deleted successfully' });
    }
    catch (error) {
        console.error(error);
        return res.status(400).send({ message: 'Something went wrong. Message not deleted successfully' });
    }
});
//Initiate pooling
//Form list of users
const filterUsers = (task, users) => {
    return users.filter(user => task.roles.includes(user.role));
};
// In fact - waiting state
app.listen(port, () => {
    console.log("Server started on http://localhost:" + port);
});
