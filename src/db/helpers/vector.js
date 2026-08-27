"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosineDistance = cosineDistance;
exports.cosineSimilarity = cosineSimilarity;
var drizzle_orm_1 = require("drizzle-orm");
/**
 * Generates type-safe cosine distance SQL expression for pgvector (<=>)
 * @param column Database vector column
 * @param vector Target embedding array
 */
function cosineDistance(column, vector) {
    if (!vector || vector.length === 0) {
        throw new Error('[Vector Error]: Target vector cannot be empty.');
    }
    var vectorString = "[".concat(vector.join(','), "]");
    return (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " <=> ", "::vector"], ["", " <=> ", "::vector"])), column, vectorString);
}
/**
 * Converts cosine distance to cosine similarity score: (1 - distance)
 */
function cosineSimilarity(column, vector) {
    return (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["1 - (", ")"], ["1 - (", ")"])), cosineDistance(column, vector));
}
var templateObject_1, templateObject_2;
