/**
 * Every call the React client makes against `/api/v1/`.
 *
 * The module is the single place where the URL contract lives, so a backend
 * route rename only has to be fixed here.
 */

import api, { downloadCsv } from './client.js';

const unwrap = (response) => response.data;

/* ------------------------------------------------------------------ auth */
export const authApi = {
  register: (payload) => api.post('/auth/register/', payload).then(unwrap),
  login: (payload) => api.post('/auth/login/', payload).then(unwrap),
  refresh: (payload) => api.post('/auth/refresh/', payload).then(unwrap),
  logout: (refresh) => api.post('/auth/logout/', { refresh }).then(unwrap),
  me: () => api.get('/auth/me/').then(unwrap),
  changePassword: (payload) => api.post('/auth/change-password/', payload).then(unwrap),
  serverTime: () => api.get('/auth/server-time/').then(unwrap),
};

/* --------------------------------------------------------------- students */
export const studentApi = {
  directory: (params) => api.get('/students/', { params }).then(unwrap),
  me: () => api.get('/students/me/').then(unwrap),
  updateMe: (payload) => api.patch('/students/me/', payload).then(unwrap),
  departments: (params) => api.get('/students/departments/', { params }).then(unwrap),
  detail: (id) => api.get(`/students/${id}/`).then(unwrap),
  setActive: (id, action) => api.post(`/students/${id}/`, { action }).then(unwrap),
  mySkills: () => api.get('/students/me/skills/').then(unwrap),
  addSkill: (payload) => api.post('/students/me/skills/', payload).then(unwrap),
  updateSkill: (id, payload) => api.patch(`/students/me/skills/${id}/`, payload).then(unwrap),
  removeSkill: (id) => api.delete(`/students/me/skills/${id}/`),
  studentSkills: (id) => api.get(`/students/${id}/skills/`).then(unwrap),
};

/* ----------------------------------------------------------------- skills */
export const skillApi = {
  list: (params) => api.get('/skills/', { params }).then(unwrap),
  create: (payload) => api.post('/skills/', payload).then(unwrap),
};

/* --------------------------------------------------------------- companies */
export const companyApi = {
  list: (params) => api.get('/companies/', { params }).then(unwrap),
  detail: (id) => api.get(`/companies/${id}/`).then(unwrap),
  create: (payload) => api.post('/companies/', payload).then(unwrap),
  update: (id, payload) => api.patch(`/companies/${id}/`, payload).then(unwrap),
  remove: (id) => api.delete(`/companies/${id}/`),
  drives: (id) => api.get(`/companies/${id}/drives/`).then(unwrap),
};

/* -------------------------------------------------------------- recruiters */
export const recruiterApi = {
  list: (params) => api.get('/recruiters/', { params }).then(unwrap),
  detail: (id) => api.get(`/recruiters/${id}/`).then(unwrap),
  provision: (payload) => api.post('/recruiters/provision/', payload).then(unwrap),
  authorize: (id) => api.post(`/recruiters/${id}/authorize/`).then(unwrap),
  revoke: (id) => api.post(`/recruiters/${id}/revoke/`).then(unwrap),
};

/* ----------------------------------------------------------------- drives */
export const driveApi = {
  list: (params) => api.get('/drives/', { params }).then(unwrap),
  detail: (id) => api.get(`/drives/${id}/`).then(unwrap),
  create: (payload) => api.post('/drives/', payload).then(unwrap),
  update: (id, payload) => api.patch(`/drives/${id}/`, payload).then(unwrap),
  remove: (id) => api.delete(`/drives/${id}/`),
  publish: (id) => api.post(`/drives/${id}/publish/`).then(unwrap),
  close: (id) => api.post(`/drives/${id}/close/`).then(unwrap),
  cancel: (id) => api.post(`/drives/${id}/cancel/`).then(unwrap),
  submit: (id) => api.post(`/drives/${id}/submit/`).then(unwrap),
  eligibility: (id, params) => api.get(`/drives/${id}/eligibility/`, { params }).then(unwrap),
};

/* ------------------------------------------------------------ applications */
export const applicationApi = {
  list: (params) => api.get('/applications/', { params }).then(unwrap),
  mine: () => api.get('/my-applications/').then(unwrap),
  summary: () => api.get('/application-summary/').then(unwrap),
  detail: (id) => api.get(`/applications/${id}/`).then(unwrap),
  submit: (payload) => api.post('/applications/', payload).then(unwrap),
  history: (id) => api.get(`/applications/${id}/history/`).then(unwrap),
  changeStatus: (id, payload) => api.post(`/applications/${id}/status/`, payload).then(unwrap),
  updateNotes: (id, payload) => api.patch(`/applications/${id}/notes/`, payload).then(unwrap),
};

/* -------------------------------------------------------------- interviews */
export const interviewApi = {
  rounds: (params) => api.get('/rounds/', { params }).then(unwrap),
  createRound: (payload) => api.post('/rounds/', payload).then(unwrap),
  updateRound: (id, payload) => api.patch(`/rounds/${id}/`, payload).then(unwrap),
  removeRound: (id) => api.delete(`/rounds/${id}/`),
  list: (params) => api.get('/interviews/', { params }).then(unwrap),
  mine: (params) => api.get('/my-interviews/', { params }).then(unwrap),
  schedule: (payload) => api.post('/interviews/', payload).then(unwrap),
  recordOutcome: (id, payload) => api.post(`/interviews/${id}/outcome/`, payload).then(unwrap),
};

/* ----------------------------------------------------------- notifications */
export const notificationApi = {
  list: (params) => api.get('/notifications/', { params }).then(unwrap),
  stats: () => api.get('/notification-stats/').then(unwrap),
  unreadCount: () => api.get('/notifications/unread-count/').then(unwrap),
  markRead: (id) => api.post(`/notifications/${id}/read/`).then(unwrap),
  markAllRead: () => api.post('/notifications/read-all/').then(unwrap),
  broadcast: (payload) => api.post('/notifications/broadcast/', payload).then(unwrap),
};

/* ----------------------------------------------------------------- reports */
export const reportApi = {
  dashboard: () => api.get('/dashboard/').then(unwrap),
  analytics: () => api.get('/analytics/').then(unwrap),
  departments: () => api.get('/reports/departments/').then(unwrap),
  companies: () => api.get('/reports/companies/').then(unwrap),
  funnel: () => api.get('/reports/funnel/').then(unwrap),
  drives: () => api.get('/reports/drives/').then(unwrap),
  exports: () => api.get('/reports/export/').then(unwrap),
  auditLogs: (params) => api.get('/audit-logs/', { params }).then(unwrap),
  download: (kind, params) =>
    downloadCsv(
      `/reports/export/${kind}/`,
      `${kind}.csv`,
    ),
};

/* ------------------------------------------------------------------ health */
export const healthApi = {
  check: () => api.get('/health/').then(unwrap),
};
