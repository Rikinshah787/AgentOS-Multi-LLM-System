const { Pool } = require('pg');

// Database connection settings
const dbConfig = {
    user: 'your_username',
    host: 'your_host',
    database: 'task_manager',
    password: 'your_password',
    port: 5432,
};

// Create a new database pool
const pool = new Pool(dbConfig);

// Function to create a new task
async function createTask(title, description, agent) {
    try {
        const result = await pool.query(
            'INSERT INTO tasks (title, description, agent) VALUES ($1, $2, $3) RETURNING *',
            [title, description, agent]
        );
        return result.rows[0];
    } catch (err) {
        console.error(err);
        return null;
    }
}

// Function to get all tasks
async function getTasks() {
    try {
        const result = await pool.query('SELECT * FROM tasks');
        return result.rows;
    } catch (err) {
        console.error(err);
        return [];
    }
}

// Function to update a task
async function updateTask(id, status) {
    try {
        const result = await pool.query(
            'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    } catch (err) {
        console.error(err);
        return null;
    }
}

// Example usage
async function main() {
    // Create a new task
    const newTask = await createTask('New Task', 'This is a new task', 'Groq Llama');
    console.log(newTask);

    // Get all tasks
    const tasks = await getTasks();
    console.log(tasks);

    // Update a task
    const updatedTask = await updateTask(1, 'completed');
    console.log(updatedTask);
}

main();