/**
 * ESLint rule: enforce-shared-imports
 * Enforces that Lambda handlers use @ai-learning-hub/* shared libraries
 * for logging, middleware, db, validation, and types.
 *
 * Usage: Add to eslint.config.js for backend/functions/**
 */

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce Lambda handlers use @ai-learning-hub/* shared libraries",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      forbiddenImport:
        "Lambda handlers must use '@ai-learning-hub/{{library}}' instead of '{{forbidden}}' (shared library requirement)",
      missingSharedImport:
        "Lambda handlers should import from @ai-learning-hub/* for {{feature}}",
    },
    schema: [],
  },

  create(context) {
    // Only apply to Lambda handler files
    const filename = context.getFilename();
    if (!filename.includes("backend/functions/")) {
      return {};
    }

    const forbiddenPatterns = [
      // Logging: must use @ai-learning-hub/logging
      { pattern: /console\.(log|error|warn|info|debug)/, library: "logging" },
      { pattern: /^winston$/, library: "logging" },
      { pattern: /^pino$/, library: "logging" },

      // AWS SDK: must use @ai-learning-hub/db for DynamoDB
      {
        pattern: /^@aws-sdk\/client-dynamodb$/,
        library: "db",
        forbidden: "@aws-sdk/client-dynamodb",
      },
      {
        pattern: /^aws-sdk\/clients\/dynamodb$/,
        library: "db",
        forbidden: "aws-sdk/clients/dynamodb",
      },

      // Validation: must use @ai-learning-hub/validation
      { pattern: /^zod$/, library: "validation", forbidden: "zod" },
      { pattern: /^joi$/, library: "validation", forbidden: "joi" },
      { pattern: /^ajv$/, library: "validation", forbidden: "ajv" },
    ];

    return {
      ImportDeclaration(node) {
        const importSource = node.source.value;

        // Check forbidden direct imports
        for (const { pattern, library, forbidden } of forbiddenPatterns) {
          if (pattern.test(importSource)) {
            context.report({
              node: node.source,
              messageId: "forbiddenImport",
              data: {
                library,
                forbidden: forbidden || importSource,
              },
            });
          }
        }
      },

      CallExpression(node) {
        // Check for console.* calls
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.name === "console" &&
          ["log", "error", "warn", "info", "debug"].includes(
            node.callee.property.name
          )
        ) {
          context.report({
            node,
            messageId: "forbiddenImport",
            data: {
              library: "logging",
              forbidden: `console.${node.callee.property.name}`,
            },
          });
        }
      },
    };
  },
};
