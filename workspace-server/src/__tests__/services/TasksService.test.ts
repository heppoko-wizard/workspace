/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { TasksService } from '../../services/TasksService';
import { google } from 'googleapis';

// Mock the googleapis module
jest.mock('googleapis');
jest.mock('../../utils/logger');

describe('TasksService', () => {
  let tasksService: TasksService;
  let mockAuthManager: any;
  let mockTasksAPI: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create mock AuthManager
    mockAuthManager = {
      getAuthenticatedClient: jest.fn(),
    };

    // Create mock Tasks API
    mockTasksAPI = {
      tasklists: {
        list: jest.fn(),
      },
      tasks: {
        list: jest.fn(),
        insert: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
      },
    };

    // Mock the google.tasks constructor
    (google.tasks as jest.Mock) = jest.fn().mockReturnValue(mockTasksAPI);

    // Create TasksService instance
    tasksService = new TasksService(mockAuthManager);

    const mockAuthClient = { access_token: 'test-token' };
    mockAuthManager.getAuthenticatedClient.mockResolvedValue(mockAuthClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listTaskLists', () => {
    it('should list all task lists', async () => {
      const mockTaskLists = [
        { id: 'list1', title: 'My Tasks' },
        { id: 'list2', title: 'Work' },
      ];

      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: mockTaskLists,
        },
      });

      const result = await tasksService.listTaskLists();

      expect(mockTasksAPI.tasklists.list).toHaveBeenCalledTimes(1);
      expect(JSON.parse(result.content[0].text)).toEqual(mockTaskLists);
    });

    it('should handle empty task list', async () => {
      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: [],
        },
      });

      const result = await tasksService.listTaskLists();
      expect(JSON.parse(result.content[0].text)).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockTasksAPI.tasklists.list.mockRejectedValue(new Error('API Error'));

      const result = await tasksService.listTaskLists();
      expect(JSON.parse(result.content[0].text)).toEqual({
        error: 'API Error',
      });
    });
  });

  describe('listTasks', () => {
    beforeEach(() => {
      // Mock getDefaultTasklistId behavior via tasklists.list
      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: [{ id: 'default-list', title: 'My Tasks' }],
        },
      });
    });

    it('should list tasks from default list when no list ID provided', async () => {
      const mockTasks = [
        { id: 'task1', title: 'Task 1' },
      ];

      mockTasksAPI.tasks.list.mockResolvedValue({
        data: {
          items: mockTasks,
        },
      });

      const result = await tasksService.listTasks({});

      expect(mockTasksAPI.tasklists.list).toHaveBeenCalled(); // To get default list
      expect(mockTasksAPI.tasks.list).toHaveBeenCalledWith(expect.objectContaining({
        tasklist: 'default-list',
      }));
      expect(JSON.parse(result.content[0].text)).toEqual(mockTasks);
    });

    it('should list tasks from specified list', async () => {
      const mockTasks = [
        { id: 'task1', title: 'Task 1' },
      ];

      mockTasksAPI.tasks.list.mockResolvedValue({
        data: {
          items: mockTasks,
        },
      });

      const result = await tasksService.listTasks({ tasklistId: 'custom-list' });

      expect(mockTasksAPI.tasklists.list).not.toHaveBeenCalled(); // Shouldn't need default list
      expect(mockTasksAPI.tasks.list).toHaveBeenCalledWith(expect.objectContaining({
        tasklist: 'custom-list',
      }));
      expect(JSON.parse(result.content[0].text)).toEqual(mockTasks);
    });

    it('should pass filter parameters', async () => {
      mockTasksAPI.tasks.list.mockResolvedValue({ data: { items: [] } });

      await tasksService.listTasks({
        tasklistId: 'list1',
        showCompleted: true,
        showDeleted: true,
        showHidden: true,
        dueMin: '2024-01-01T00:00:00Z',
        dueMax: '2024-01-31T23:59:59Z',
      });

      expect(mockTasksAPI.tasks.list).toHaveBeenCalledWith({
        tasklist: 'list1',
        showCompleted: true,
        showDeleted: true,
        showHidden: true,
        dueMin: '2024-01-01T00:00:00Z',
        dueMax: '2024-01-31T23:59:59Z',
      });
    });
  });

  describe('createTask', () => {
    beforeEach(() => {
      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: [{ id: 'default-list', title: 'My Tasks' }],
        },
      });
    });

    it('should create a task', async () => {
      const newTask = {
        id: 'new-task',
        title: 'New Task',
        notes: 'Some notes',
        status: 'needsAction',
      };

      mockTasksAPI.tasks.insert.mockResolvedValue({ data: newTask });

      const result = await tasksService.createTask({
        title: 'New Task',
        notes: 'Some notes',
      });

      expect(mockTasksAPI.tasks.insert).toHaveBeenCalledWith({
        tasklist: 'default-list',
        requestBody: {
          title: 'New Task',
          notes: 'Some notes',
          due: undefined,
          status: undefined,
        },
      });

      expect(JSON.parse(result.content[0].text)).toEqual(newTask);
    });
  });

  describe('updateTask', () => {
    beforeEach(() => {
      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: [{ id: 'default-list', title: 'My Tasks' }],
        },
      });
    });

    it('should update a task', async () => {
      const updatedTask = {
        id: 'task1',
        title: 'Updated Title',
      };

      mockTasksAPI.tasks.patch.mockResolvedValue({ data: updatedTask });

      const result = await tasksService.updateTask({
        taskId: 'task1',
        title: 'Updated Title',
      });

      expect(mockTasksAPI.tasks.patch).toHaveBeenCalledWith({
        tasklist: 'default-list',
        task: 'task1',
        requestBody: {
          title: 'Updated Title',
        },
      });

      expect(JSON.parse(result.content[0].text)).toEqual(updatedTask);
    });

    it('should update task status', async () => {
        const updatedTask = {
          id: 'task1',
          status: 'completed',
        };

        mockTasksAPI.tasks.patch.mockResolvedValue({ data: updatedTask });

        const result = await tasksService.updateTask({
          taskId: 'task1',
          status: 'completed',
        });

        expect(mockTasksAPI.tasks.patch).toHaveBeenCalledWith({
          tasklist: 'default-list',
          task: 'task1',
          requestBody: {
            status: 'completed',
          },
        });

        expect(JSON.parse(result.content[0].text)).toEqual(updatedTask);
      });
  });

  describe('deleteTask', () => {
    beforeEach(() => {
      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: [{ id: 'default-list', title: 'My Tasks' }],
        },
      });
    });

    it('should delete a task', async () => {
      mockTasksAPI.tasks.delete.mockResolvedValue({});

      const result = await tasksService.deleteTask({
        taskId: 'task1',
      });

      expect(mockTasksAPI.tasks.delete).toHaveBeenCalledWith({
        tasklist: 'default-list',
        task: 'task1',
      });

      expect(JSON.parse(result.content[0].text)).toEqual({
        message: 'Successfully deleted task task1',
      });
    });
  });

  describe('getTask', () => {
    beforeEach(() => {
      mockTasksAPI.tasklists.list.mockResolvedValue({
        data: {
          items: [{ id: 'default-list', title: 'My Tasks' }],
        },
      });
    });

    it('should get a task', async () => {
      const mockTask = { id: 'task1', title: 'Task 1' };
      mockTasksAPI.tasks.get.mockResolvedValue({ data: mockTask });

      const result = await tasksService.getTask({
        taskId: 'task1',
      });

      expect(mockTasksAPI.tasks.get).toHaveBeenCalledWith({
        tasklist: 'default-list',
        task: 'task1',
      });

      expect(JSON.parse(result.content[0].text)).toEqual(mockTask);
    });
  });
});
