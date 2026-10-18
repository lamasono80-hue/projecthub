/**
 * api/index.js — Vercel Serverless Function Entry Point for ProjectHub
 *
 * Chuyển tiếp các request từ Vercel Serverless Function sang Express application.
 */
'use strict';

const app = require('../server/server.js');

module.exports = app;
