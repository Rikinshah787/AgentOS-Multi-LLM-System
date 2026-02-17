const request = require('supertest');
const app = require('../server');
const { v4: uuidv4 } = require('uuid');

describe('Task API', () => {
  let testTaskId;

  beforeEach(() => {
    // Reset tasks before each test
    app.locals.tasks = [];
  });

  // Test GET /api/tasks
  describe('GET /api/tasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([]);
    });

    it('should return all tasks', async () => {
      // Add test tasks
      const testTasks = [
        { title: 'Task 1', description: 'Description 1', status: 'todo' },
        { title: 'Task 2', description: 'Description 2', status: 'in-progress' }
      ];

      for (const task of testTasks) {
        await request(app).post('/api/tasks').send(task);
      }

      const res = await request(app).get('/api/tasks');
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(2);
      testTaskId = res.body[0].id; // Store ID for later tests
    });
  });

  // Test GET /api/tasks/:id
  describe('GET /api/tasks/:id', () => {
    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get(`/api/tasks/${uuidv4()}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should return a single task', async () => {
      const testTask = { title: 'Test Task', description: 'Test Description' };
      const postRes = await request(app).post('/api/tasks').send(testTask);

      const res = await request(app).get(`/api/tasks/${postRes.body.id}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.title).toEqual(testTask.title);
      expect(res.body.description).toEqual(testTask.description);
    });
  });

  // Test POST /api/tasks
  describe('POST /api/tasks', () => {
    it('should create a new task with valid data', async () => {
      const testTask = {
        title: 'Valid Task',
        description: 'Valid Description',
        status: 'todo',
        dueDate: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      };

      const res = await request(app).post('/api/tasks').send(testTask);
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toEqual(testTask.title);
      expect(res.body.status).toEqual(testTask.status);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidTask = { description: 'Missing title' };
      const res = await request(app).post('/api/tasks').send(invalidTask);
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('"title" is required');
    });

    it('should return 400 for invalid status', async () => {
      const invalidTask = {
        title: 'Invalid Status',
        description: 'Test',
        status: 'invalid-status'
      };
      const res = await request(app).post('/api/tasks').send(invalidTask);
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('"status" must be one of');
    });

    it('should return 400 for past due date', async () => {
      const invalidTask = {
        title: 'Past Due Date',
        description: 'Test',
        dueDate: new Date(Date.now() - 86400000).toISOString() // Yesterday
      };
      const res = await request(app).post('/api/tasks').send(invalidTask);
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('"dueDate" must be greater than "now"');
    });
  });

  // Test PUT /api/tasks/:id
  describe('PUT /api/tasks/:id', () => {
    it('should update an existing task with valid data', async () => {
      const testTask = { title: 'Original', description: 'Original' };
      const postRes = await request(app).post('/api/tasks').send(testTask);

      const updatedTask = {
        title: 'Updated',
        description: 'Updated Description',
        status: 'in-progress'
      };

      const res = await request(app)
        .put(`/api/tasks/${postRes.body.id}`)
        .send(updatedTask);

      expect(res.statusCode).toEqual(200);
      expect(res.body.title).toEqual(updatedTask.title);
      expect(res.body.description).toEqual(updatedTask.description);
      expect(res.body.status).toEqual(updatedTask.status);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app)
        .put(`/api/tasks/${uuidv4()}`)
        .send({ title: 'Test', description: 'Test' });
      expect(res.statusCode).toEqual(404);
    });

    it('should return 400 for invalid update data', async () => {
      const testTask = { title: 'Test', description: 'Test' };
      const postRes = await request(app).post('/api/tasks').send(testTask);

      const res = await request(app)
        .put(`/api/tasks/${postRes.body.id}`)
        .send({ title: '', description: 'Invalid' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('"title" is not allowed to be empty');
    });
  });

  // Test DELETE /api/tasks/:id
  describe('DELETE /api/tasks/:id', () => {
    it('should delete an existing task', async () => {
      const testTask = { title: 'To Delete', description: 'Test' };
      const postRes = await request(app).post('/api/tasks').send(testTask);

      const deleteRes = await request(app).delete(`/api/tasks/${postRes.body.id}`);
      expect(deleteRes.statusCode).toEqual(204);

      // Verify task is deleted
      const getRes = await request(app).get(`/api/tasks/${postRes.body.id}`);
      expect(getRes.statusCode).toEqual(404);
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).delete(`/api/tasks/${uuidv4()}`);
      expect(res.statusCode).toEqual(404);
    });
  });
});