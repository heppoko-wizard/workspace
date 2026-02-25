/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { tasks_v1, google } from 'googleapis';
import { logToFile } from '../utils/logger';
import { gaxiosOptions } from '../utils/GaxiosConfig';

export interface CreateTaskInput {
  tasklistId?: string;
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp
  status?: 'needsAction' | 'completed';
}

export interface ListTasksInput {
  tasklistId?: string;
  showCompleted?: boolean;
  showDeleted?: boolean;
  showHidden?: boolean;
  dueMin?: string;
  dueMax?: string;
}

export interface GetTaskInput {
  taskId: string;
  tasklistId?: string;
}

export interface DeleteTaskInput {
  taskId: string;
  tasklistId?: string;
}

export interface UpdateTaskInput {
  taskId: string;
  tasklistId?: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
}

export class TasksService {
  private defaultTasklistId: string | null = null;

  constructor(private authManager: any) {}

  private async getTasksClient(): Promise<tasks_v1.Tasks> {
    logToFile('Getting authenticated client for tasks...');
    const auth = await this.authManager.getAuthenticatedClient();
    logToFile('Got auth client, creating tasks instance...');
    const options = { ...gaxiosOptions, auth };
    return google.tasks({ version: 'v1', ...options });
  }

  private async getDefaultTasklistId(): Promise<string> {
    if (this.defaultTasklistId) {
      return this.defaultTasklistId;
    }
    logToFile('Getting default tasklist ID...');
    const tasks = await this.getTasksClient();
    const res = await tasks.tasklists.list();
    // The first list is usually the default one, often named "My Tasks"
    const defaultList = res.data.items?.[0];
    if (defaultList && defaultList.id) {
      logToFile(`Found default tasklist: ${defaultList.title} (${defaultList.id})`);
      this.defaultTasklistId = defaultList.id;
      return defaultList.id;
    }
    // Fallback to strict default if list is empty or fails
    logToFile('No tasklists found, defaulting to "@default"');
    return '@default';
  }

  listTaskLists = async () => {
    logToFile('listTaskLists called');
    try {
      const tasks = await this.getTasksClient();
      const res = await tasks.tasklists.list();
      logToFile(`Found ${res.data.items?.length} tasklists.`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(res.data.items || []),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`Error during tasks.listTaskLists: ${errorMessage}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  listTasks = async (input: ListTasksInput) => {
    const {
      tasklistId,
      showCompleted = false,
      showDeleted = false,
      showHidden = false,
      dueMin,
      dueMax,
    } = input;

    const finalTasklistId = tasklistId || (await this.getDefaultTasklistId());
    logToFile(`Listing tasks for tasklist: ${finalTasklistId}`);

    try {
      const tasks = await this.getTasksClient();
      const res = await tasks.tasks.list({
        tasklist: finalTasklistId,
        showCompleted,
        showDeleted,
        showHidden,
        dueMin,
        dueMax,
      });

      logToFile(`Found ${res.data.items?.length} tasks.`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(res.data.items || []),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`Error during tasks.listTasks: ${errorMessage}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  createTask = async (input: CreateTaskInput) => {
    const { tasklistId, title, notes, due, status } = input;
    const finalTasklistId = tasklistId || (await this.getDefaultTasklistId());

    logToFile(`Creating task in tasklist: ${finalTasklistId}`);
    logToFile(`Task title: ${title}`);

    try {
      const tasks = await this.getTasksClient();
      const requestBody: tasks_v1.Schema$Task = {
        title,
        notes,
        due,
        status,
      };

      const res = await tasks.tasks.insert({
        tasklist: finalTasklistId,
        requestBody,
      });

      logToFile(`Successfully created task: ${res.data.id}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(res.data),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`Error during tasks.createTask: ${errorMessage}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  updateTask = async (input: UpdateTaskInput) => {
    const { taskId, tasklistId, title, notes, due, status } = input;
    const finalTasklistId = tasklistId || (await this.getDefaultTasklistId());

    logToFile(`Updating task ${taskId} in tasklist: ${finalTasklistId}`);

    try {
      const tasks = await this.getTasksClient();

      // First get the task to preserve other fields if needed,
      // although patch semantics usually only update provided fields.
      // The Google Tasks API `update` method is actually a PUT (replace),
      // but `patch` is also available and safer for partial updates.
      // However, the nodejs client `update` maps to PUT.
      // `patch` maps to PATCH. Let's use `patch`.

      const requestBody: tasks_v1.Schema$Task = {};
      if (title !== undefined) requestBody.title = title;
      if (notes !== undefined) requestBody.notes = notes;
      if (due !== undefined) requestBody.due = due;
      if (status !== undefined) requestBody.status = status;

      const res = await tasks.tasks.patch({
        tasklist: finalTasklistId,
        task: taskId,
        requestBody,
      });

      logToFile(`Successfully updated task: ${res.data.id}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(res.data),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`Error during tasks.updateTask: ${errorMessage}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  deleteTask = async (input: DeleteTaskInput) => {
    const { taskId, tasklistId } = input;
    const finalTasklistId = tasklistId || (await this.getDefaultTasklistId());

    logToFile(`Deleting task ${taskId} from tasklist: ${finalTasklistId}`);

    try {
      const tasks = await this.getTasksClient();
      await tasks.tasks.delete({
        tasklist: finalTasklistId,
        task: taskId,
      });

      logToFile(`Successfully deleted task: ${taskId}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              message: `Successfully deleted task ${taskId}`,
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`Error during tasks.deleteTask: ${errorMessage}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  getTask = async (input: GetTaskInput) => {
    const { taskId, tasklistId } = input;
    const finalTasklistId = tasklistId || (await this.getDefaultTasklistId());

    logToFile(`Getting task ${taskId} from tasklist: ${finalTasklistId}`);

    try {
      const tasks = await this.getTasksClient();
      const res = await tasks.tasks.get({
        tasklist: finalTasklistId,
        task: taskId,
      });

      logToFile(`Successfully retrieved task: ${res.data.id}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(res.data),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`Error during tasks.getTask: ${errorMessage}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };
}
