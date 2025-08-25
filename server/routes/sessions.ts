import { RequestHandler } from 'express';

// In-memory storage (replace with database)
const sessions: Record<string, unknown>[] = [];
let nextId = 1;

export const getSessions: RequestHandler = (req, res) => {
  res.json(sessions);
};

export const getSession: RequestHandler = (req, res) => {
  const { id } = req.params;
  const session = sessions.find(s => s.id === parseInt(id));

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
};

export const createSession: RequestHandler = (req, res) => {
  const sessionData = {
    id: nextId++,
    ...req.body,
    createdAt: new Date().toISOString(),
  };

  sessions.push(sessionData);
  res.status(201).json(sessionData);
};

export const updateSession: RequestHandler = (req, res) => {
  const { id } = req.params;
  const sessionIndex = sessions.findIndex(s => s.id === parseInt(id));

  if (sessionIndex === -1) {
    return res.status(404).json({ error: 'Session not found' });
  }

  sessions[sessionIndex] = {
    ...sessions[sessionIndex],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  res.json(sessions[sessionIndex]);
};
