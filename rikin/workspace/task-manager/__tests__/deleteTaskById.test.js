const { deleteTaskById } = require('../index');
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'task_manager',
  password: 'password',
  port: 5432,
});

beforeAll(async () => {
  await pool.query('CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, title VARCHAR(255), description TEXT)');
});

afterAll(async () => {
  await pool.query('DROP TABLE tasks');
  await pool.end();
});

describe('deleteTaskById function', () => {
  it('should delete a task by id', async () => {
    // Insert a task into the database
    const result = await pool.query('INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *', ['Test Task', 'This is a test task']);
    const taskId = result.rows[0].id;

    // Delete the task
    await deleteTaskById(taskId);

    // Check if the task is deleted
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    expect(taskResult.rows.length).toBe(0);
  });

  it('should throw an error if the task does not exist', async () => {
    await expect(deleteTaskById(999)).rejects.toThrowError('Task not found');
  });

  it('should throw an error if the database connection fails', async () => {
    // Mock the database connection to fail
    jest.spyOn(pool, 'query').mockRejectedValue(new Error('Database connection failed'));

    await expect(deleteTaskById(1)).rejects.toThrowError('Database connection failed');
  });
});