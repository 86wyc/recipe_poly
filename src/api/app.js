"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
var hono_1 = require("hono");
var recipes_1 = require("./routes/recipes");
var errors_1 = require("./errors");
exports.app = new hono_1.Hono();
// Global error handler (must be registered before routes)
exports.app.onError(errors_1.errorHandler);
// 404 handler
exports.app.notFound(errors_1.notFoundHandler);
// Mount routers
exports.app.route('/api/recipes', recipes_1.recipesRouter);
exports.app.route('/api', recipes_1.recommendationRouter);
