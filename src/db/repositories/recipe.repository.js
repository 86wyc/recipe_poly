"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecipeById = getRecipeById;
exports.getRecipeBySlug = getRecipeBySlug;
exports.getIngredientSubstitutions = getIngredientSubstitutions;
exports.createRecipe = createRecipe;
exports.scaleIngredientQuantity = scaleIngredientQuantity;
var drizzle_orm_1 = require("drizzle-orm");
var connection_1 = require("../connection");
var schema_1 = require("../schema");
// ============================================================================
// Validation Helpers
// ============================================================================
function validateStepDependencyGraph(graph) {
    if (!Array.isArray(graph)) {
        throw new Error('[Recipe] stepDependencyGraph must be an array');
    }
    var stepIds = new Set();
    for (var _i = 0, graph_1 = graph; _i < graph_1.length; _i++) {
        var node = graph_1[_i];
        // snake_case properties from StepDependencyNode interface
        if (!node.step_id || typeof node.step_id !== 'string') {
            throw new Error('[Recipe] Each step node requires a string step_id');
        }
        if (node.step_id.length > 255) {
            throw new Error('[Recipe] step_id exceeds 255 character limit');
        }
        if (!node.action_type || typeof node.action_type !== 'string') {
            throw new Error('[Recipe] Each step node requires a string action_type');
        }
        if (typeof node.description !== 'string') {
            throw new Error('[Recipe] Each step node requires a string description');
        }
        if (typeof node.is_passive !== 'boolean') {
            throw new Error('[Recipe] Each step node requires a boolean is_passive');
        }
        if (!Array.isArray(node.depends_on_step_ids)) {
            throw new Error('[Recipe] Each step node requires depends_on_step_ids array');
        }
        if (stepIds.has(node.step_id)) {
            throw new Error("[Recipe] Duplicate step_id found: ".concat(node.step_id));
        }
        stepIds.add(node.step_id);
        if (node.temp_celsius !== undefined && node.temp_celsius !== null) {
            if (typeof node.temp_celsius !== 'number' || !Number.isFinite(node.temp_celsius)) {
                throw new Error("[Recipe] Invalid temp_celsius for step ".concat(node.step_id));
            }
            if (node.temp_celsius < -273.15 || node.temp_celsius > 500) {
                throw new Error("[Recipe] temp_celsius out of range for step ".concat(node.step_id, ": ").concat(node.temp_celsius));
            }
        }
    }
    // Validate dependency references
    for (var _a = 0, graph_2 = graph; _a < graph_2.length; _a++) {
        var node = graph_2[_a];
        for (var _b = 0, _c = node.depends_on_step_ids; _b < _c.length; _b++) {
            var depId = _c[_b];
            if (!stepIds.has(depId)) {
                throw new Error("[Recipe] Step ".concat(node.step_id, " references non-existent dependency: ").concat(depId));
            }
            if (depId === node.step_id) {
                throw new Error("[Recipe] Step ".concat(node.step_id, " cannot depend on itself"));
            }
        }
    }
    // Cycle detection (DFS)
    var visiting = new Set();
    var visited = new Set();
    function hasCycle(stepId) {
        if (visiting.has(stepId))
            return true;
        if (visited.has(stepId))
            return false;
        visiting.add(stepId);
        var node = graph.find(function (n) { return n.step_id === stepId; });
        if (node) {
            for (var _i = 0, _a = node.depends_on_step_ids; _i < _a.length; _i++) {
                var depId = _a[_i];
                if (hasCycle(depId))
                    return true;
            }
        }
        visiting.delete(stepId);
        visited.add(stepId);
        return false;
    }
    for (var _d = 0, graph_3 = graph; _d < graph_3.length; _d++) {
        var node = graph_3[_d];
        if (hasCycle(node.step_id)) {
            throw new Error("[Recipe] Cycle detected in step dependency graph at step ".concat(node.step_id));
        }
    }
}
function validateAttributeVector(vector) {
    if (vector.length !== 4) {
        throw new Error("[Recipe] attributeVector must have exactly 4 dimensions, got ".concat(vector.length));
    }
    for (var _i = 0, vector_1 = vector; _i < vector_1.length; _i++) {
        var value = vector_1[_i];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new Error("[Recipe] attributeVector contains non-finite value: ".concat(value));
        }
        if (value < 0 || value > 1) {
            throw new Error("[Recipe] attributeVector values must be between 0 and 1, got ".concat(value));
        }
    }
}
// ============================================================================
// Shared Query Builder
// ============================================================================
function buildRecipeWithDetails(whereClause, targetServings) {
    return __awaiter(this, void 0, void 0, function () {
        var recipe, _a, ingredientRows, vectorRows, childVariantRows, parentVariantRows, scaledIngredients;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, connection_1.db.select().from(schema_1.recipes).where(whereClause).limit(1)];
                case 1:
                    recipe = (_d.sent())[0];
                    if (!recipe) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, Promise.all([
                            connection_1.db
                                .select({
                                id: schema_1.recipeIngredients.id,
                                name: schema_1.ingredients.name,
                                category: schema_1.ingredients.category,
                                quantityBase: schema_1.recipeIngredients.quantityBase,
                                unit: schema_1.recipeIngredients.unit,
                                notes: schema_1.recipeIngredients.notes,
                                isOptional: schema_1.recipeIngredients.isOptional,
                            })
                                .from(schema_1.recipeIngredients)
                                .innerJoin(schema_1.ingredients, (0, drizzle_orm_1.eq)(schema_1.recipeIngredients.ingredientId, schema_1.ingredients.id))
                                .where((0, drizzle_orm_1.eq)(schema_1.recipeIngredients.recipeId, recipe.id))
                                .orderBy((0, drizzle_orm_1.asc)(schema_1.ingredients.name)),
                            connection_1.db
                                .select()
                                .from(schema_1.recipeVectors)
                                .where((0, drizzle_orm_1.eq)(schema_1.recipeVectors.recipeId, recipe.id))
                                .limit(1),
                            connection_1.db
                                .select({
                                id: schema_1.recipes.id,
                                title: schema_1.recipes.title,
                                slug: schema_1.recipes.slug,
                                variantType: schema_1.recipeVariants.variantType,
                                notes: schema_1.recipeVariants.notes,
                            })
                                .from(schema_1.recipeVariants)
                                .innerJoin(schema_1.recipes, (0, drizzle_orm_1.eq)(schema_1.recipeVariants.variantRecipeId, schema_1.recipes.id))
                                .where((0, drizzle_orm_1.eq)(schema_1.recipeVariants.baseRecipeId, recipe.id))
                                .orderBy((0, drizzle_orm_1.asc)(schema_1.recipes.title)),
                            connection_1.db
                                .select({
                                id: schema_1.recipes.id,
                                title: schema_1.recipes.title,
                                slug: schema_1.recipes.slug,
                                variantType: schema_1.recipeVariants.variantType,
                                notes: schema_1.recipeVariants.notes,
                            })
                                .from(schema_1.recipeVariants)
                                .innerJoin(schema_1.recipes, (0, drizzle_orm_1.eq)(schema_1.recipeVariants.baseRecipeId, schema_1.recipes.id))
                                .where((0, drizzle_orm_1.eq)(schema_1.recipeVariants.variantRecipeId, recipe.id))
                                .limit(1),
                        ])];
                case 2:
                    _a = _d.sent(), ingredientRows = _a[0], vectorRows = _a[1], childVariantRows = _a[2], parentVariantRows = _a[3];
                    scaledIngredients = ingredientRows.map(function (ing) { return (__assign(__assign({}, ing), { scaledQuantity: ing.quantityBase * targetServings })); });
                    return [2 /*return*/, {
                            recipe: recipe,
                            ingredients: scaledIngredients,
                            stepDependencyGraph: recipe.stepDependencyGraph,
                            vector: (_b = vectorRows[0]) !== null && _b !== void 0 ? _b : null,
                            childVariants: childVariantRows,
                            parentVariant: (_c = parentVariantRows[0]) !== null && _c !== void 0 ? _c : null,
                        }];
            }
        });
    });
}
// ============================================================================
// Repository Functions
// ============================================================================
function getRecipeById(id_1) {
    return __awaiter(this, arguments, void 0, function (id, targetServings) {
        if (targetServings === void 0) { targetServings = 1; }
        return __generator(this, function (_a) {
            if (targetServings <= 0) {
                throw new Error('[Recipe] targetServings must be greater than 0');
            }
            return [2 /*return*/, buildRecipeWithDetails((0, drizzle_orm_1.eq)(schema_1.recipes.id, id), targetServings)];
        });
    });
}
function getRecipeBySlug(slug_1) {
    return __awaiter(this, arguments, void 0, function (slug, targetServings) {
        if (targetServings === void 0) { targetServings = 1; }
        return __generator(this, function (_a) {
            if (targetServings <= 0) {
                throw new Error('[Recipe] targetServings must be greater than 0');
            }
            return [2 /*return*/, buildRecipeWithDetails((0, drizzle_orm_1.eq)(schema_1.recipes.slug, slug), targetServings)];
        });
    });
}
function getIngredientSubstitutions(ingredientIds) {
    return __awaiter(this, void 0, void 0, function () {
        var originalIngredients, substituteIngredients;
        return __generator(this, function (_a) {
            if (ingredientIds.length === 0) {
                return [2 /*return*/, []];
            }
            originalIngredients = (0, drizzle_orm_1.aliasedTable)(schema_1.ingredients, 'original_ingredients');
            substituteIngredients = (0, drizzle_orm_1.aliasedTable)(schema_1.ingredients, 'substitute_ingredients');
            return [2 /*return*/, connection_1.db
                    .select({
                    originalIngredientId: schema_1.ingredientSubstitutions.originalIngredientId,
                    originalIngredientName: originalIngredients.name,
                    substituteIngredientId: schema_1.ingredientSubstitutions.substituteIngredientId,
                    substituteIngredientName: substituteIngredients.name,
                    conversionRatio: schema_1.ingredientSubstitutions.conversionRatio,
                    dietaryTags: schema_1.ingredientSubstitutions.dietaryTags,
                })
                    .from(schema_1.ingredientSubstitutions)
                    .innerJoin(originalIngredients, (0, drizzle_orm_1.eq)(schema_1.ingredientSubstitutions.originalIngredientId, originalIngredients.id))
                    .innerJoin(substituteIngredients, (0, drizzle_orm_1.eq)(schema_1.ingredientSubstitutions.substituteIngredientId, substituteIngredients.id))
                    .where((0, drizzle_orm_1.inArray)(schema_1.ingredientSubstitutions.originalIngredientId, ingredientIds))];
        });
    });
}
function createRecipe(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            validateStepDependencyGraph(input.stepDependencyGraph);
            validateAttributeVector(input.attributeVector);
            if (!input.title || input.title.length === 0 || input.title.length > 255) {
                throw new Error('[Recipe] title must be between 1 and 255 characters');
            }
            if (!input.slug || input.slug.length === 0 || input.slug.length > 255) {
                throw new Error('[Recipe] slug must be between 1 and 255 characters');
            }
            if (input.ingredients.length === 0) {
                throw new Error('[Recipe] At least one ingredient is required');
            }
            return [2 /*return*/, connection_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                    var insertedRecipe, recipeId;
                    var _a, _b, _c, _d, _e;
                    return __generator(this, function (_f) {
                        switch (_f.label) {
                            case 0: return [4 /*yield*/, tx
                                    .insert(schema_1.recipes)
                                    .values({
                                    title: input.title,
                                    slug: input.slug,
                                    description: input.description,
                                    heroImageUrl: input.heroImageUrl,
                                    baseServings: (_a = input.baseServings) !== null && _a !== void 0 ? _a : 1,
                                    prepTimeMinutes: (_b = input.prepTimeMinutes) !== null && _b !== void 0 ? _b : 0,
                                    cookTimeMinutes: (_c = input.cookTimeMinutes) !== null && _c !== void 0 ? _c : 0,
                                    totalTimeMinutes: (_d = input.totalTimeMinutes) !== null && _d !== void 0 ? _d : 0,
                                    caloriesPerServing: input.caloriesPerServing,
                                    proteinGrams: (_e = input.proteinGrams) === null || _e === void 0 ? void 0 : _e.toString(),
                                    stepDependencyGraph: input.stepDependencyGraph,
                                })
                                    .returning({ id: schema_1.recipes.id })];
                            case 1:
                                insertedRecipe = (_f.sent())[0];
                                recipeId = insertedRecipe.id;
                                return [4 /*yield*/, tx.insert(schema_1.recipeIngredients).values(input.ingredients.map(function (ing) {
                                        var _a;
                                        return ({
                                            recipeId: recipeId,
                                            ingredientId: ing.ingredientId,
                                            quantityBase: ing.quantityBase,
                                            unit: ing.unit,
                                            notes: ing.notes,
                                            isOptional: (_a = ing.isOptional) !== null && _a !== void 0 ? _a : false,
                                        });
                                    }))];
                            case 2:
                                _f.sent();
                                return [4 /*yield*/, tx.insert(schema_1.recipeVectors).values({
                                        recipeId: recipeId,
                                        attributeVector: input.attributeVector,
                                    })];
                            case 3:
                                _f.sent();
                                return [2 /*return*/, recipeId];
                        }
                    });
                }); })];
        });
    });
}
function scaleIngredientQuantity(quantityBase, targetServings) {
    if (targetServings <= 0) {
        throw new Error('[Recipe] targetServings must be greater than 0');
    }
    if (quantityBase < 0) {
        throw new Error('[Recipe] quantityBase cannot be negative');
    }
    return quantityBase * targetServings;
}
