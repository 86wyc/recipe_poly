"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSimilarRecipes = findSimilarRecipes;
exports.upsertRecipeVector = upsertRecipeVector;
exports.calculateEffectiveVector = calculateEffectiveVector;
var drizzle_orm_1 = require("drizzle-orm");
var connection_1 = require("../connection");
var schema_1 = require("../schema");
var vector_1 = require("../helpers/vector");
// ============================================================================
// Validation Helpers
// ============================================================================
function validateVector(vector) {
    if (vector.length !== 4) {
        throw new Error("[Vector] Expected 4 dimensions, got ".concat(vector.length));
    }
    for (var _i = 0, vector_2 = vector; _i < vector_2.length; _i++) {
        var value = vector_2[_i];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error("[Vector] Contains non-finite value: ".concat(value));
        }
        if (value < 0 || value > 1) {
            throw new Error("[Vector] Values must be between 0 and 1, got ".concat(value));
        }
    }
}
// ============================================================================
// Repository Functions
// ============================================================================
/**
 * Executes Tier 1 hard exclusion (NOT IN excludeRecipeIds) combined with
 * Tier 2 soft cosine distance matching via pgvector `<=>` operator.
 *
 * Returns recipe IDs sorted by similarity score descending.
 *
 * @param userVector - 4D vector [speed, minimalPrep, protein, lowCalorie]
 * @param limit - Maximum number of results to return (default 10)
 * @param excludeRecipeIds - Recipe IDs to exclude from results
 */
function findSimilarRecipes(userVector_1) {
    return __awaiter(this, arguments, void 0, function (userVector, limit, excludeRecipeIds) {
        var distance, similarity, conditions, whereClause, rows;
        if (limit === void 0) { limit = 10; }
        if (excludeRecipeIds === void 0) { excludeRecipeIds = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Validate inputs
                    validateVector(userVector);
                    if (!Number.isInteger(limit) || limit <= 0) {
                        throw new Error('[Vector] limit must be a positive integer');
                    }
                    distance = (0, vector_1.cosineDistance)(schema_1.recipeVectors.attributeVector, userVector);
                    similarity = (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["1 - (", ")"], ["1 - (", ")"])), distance);
                    conditions = [];
                    if (excludeRecipeIds.length > 0) {
                        conditions.push((0, drizzle_orm_1.notInArray)(schema_1.recipeVectors.recipeId, excludeRecipeIds));
                    }
                    whereClause = conditions.length > 0 ? drizzle_orm_1.and.apply(void 0, conditions) : undefined;
                    return [4 /*yield*/, connection_1.db
                            .select({
                            recipeId: schema_1.recipeVectors.recipeId,
                            similarityScore: similarity,
                        })
                            .from(schema_1.recipeVectors)
                            .where(whereClause)
                            .orderBy((0, drizzle_orm_1.asc)(distance))
                            .limit(limit)];
                case 1:
                    rows = _a.sent();
                    return [2 /*return*/, rows];
            }
        });
    });
}
/**
 * Atomically inserts or updates a recipe vector embedding.
 * Uses PostgreSQL `INSERT ... ON CONFLICT (recipe_id) DO UPDATE`.
 *
 * @param recipeId - Target recipe ID (primary key on recipe_vectors)
 * @param attributeVector - 4D vector [speed, minimalPrep, protein, lowCalorie]
 */
function upsertRecipeVector(recipeId, attributeVector) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Validate inputs
                    validateVector(attributeVector);
                    if (!recipeId) {
                        throw new Error('[Vector] recipeId is required');
                    }
                    return [4 /*yield*/, connection_1.db
                            .insert(schema_1.recipeVectors)
                            .values({
                            recipeId: recipeId,
                            attributeVector: attributeVector,
                            updatedAt: new Date(),
                        })
                            .onConflictDoUpdate({
                            target: schema_1.recipeVectors.recipeId,
                            set: {
                                attributeVector: attributeVector,
                                updatedAt: new Date(),
                            },
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Merges primary user preferences with optional guest preferences.
 * Formula: U_eff = (U_primary + guestWeight * U_guest) / (1 + guestWeight)
 * Each dimension clamped to [0.0, 1.0].
 *
 * @param primaryVector - 4D primary user vector
 * @param guestVector - Optional 4D guest vector
 * @param guestWeight - Weight applied to guest vector (default 0.5)
 * @returns Merged 4D vector clamped to [0,1]
 */
function calculateEffectiveVector(primaryVector, guestVector, guestWeight) {
    if (guestWeight === void 0) { guestWeight = 0.5; }
    // Validate primary
    validateVector(primaryVector);
    // If no guest vector, return primary as-is
    if (!guestVector) {
        return __spreadArray([], primaryVector, true);
    }
    // Validate guest and weight
    validateVector(guestVector);
    if (typeof guestWeight !== 'number' || !Number.isFinite(guestWeight) || guestWeight < 0) {
        throw new Error('[Vector] guestWeight must be a non-negative finite number');
    }
    // Compute weighted average and clamp
    var denominator = 1 + guestWeight;
    return primaryVector.map(function (val, i) {
        var merged = (val + guestWeight * guestVector[i]) / denominator;
        return Math.min(1, Math.max(0, merged));
    });
}
var templateObject_1;
