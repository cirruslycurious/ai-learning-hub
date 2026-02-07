#!/usr/bin/env node
/**
 * bash-guard.js - Block dangerous bash commands
 *
 * Tiered safety levels, exfiltration prevention, 50+ patterns
 * Part of AI Learning Hub's deterministic enforcement layer
 *
 * Exit codes:
 *   0 = Allow (with optional JSON for escalation)
 *   2 = Block (stderr message)
 */

const fs = require("fs");
const path = require("path");

// Safety level: 'critical' | 'high' | 'strict'
// Set via CLAUDE_SAFETY_LEVEL env var, defaults to 'high'
const SAFETY_LEVEL = process.env.CLAUDE_SAFETY_LEVEL || "high";

// Read input from stdin
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
    const command = data.tool_input?.command || "";
    const result = checkCommand(command);

    if (result.blocked) {
      console.error(`🚫 BLOCKED: ${result.reason}`);
      process.exit(2);
    }

    if (result.escalate) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            permissionDecisionReason: result.reason,
          },
        })
      );
    }

    process.exit(0);
  } catch (err) {
    // Fail CLOSED on parse error — do not allow unvalidated commands
    console.error(
      `🚫 bash-guard: Failed to parse input (${err.message}). Blocking command for safety.`
    );
    process.exit(2);
  }
});

function checkCommand(command) {
  const lowerCmd = command.toLowerCase();

  // ═══════════════════════════════════════════════════════════════════
  // CRITICAL LEVEL - Always blocked (catastrophic)
  // ═══════════════════════════════════════════════════════════════════
  const criticalPatterns = [
    {
      id: "rm-rf-root",
      regex: /\brm\s+(-[rfR]+\s+)*\/\s*$/i,
      reason: "Attempting to delete root filesystem",
    },
    {
      id: "rm-rf-home",
      regex: /\brm\s+(-[rfR]+\s+)*~\s*$/i,
      reason: "Attempting to delete home directory",
    },
    {
      id: "rm-rf-star",
      regex: /\brm\s+(-[rfR]+\s+)*\*\s*$/i,
      reason: "Attempting to delete all files",
    },
    {
      id: "fork-bomb",
      regex: /:\(\)\s*\{\s*:\|:&\s*\}\s*;/i,
      reason: "Fork bomb detected",
    },
    {
      id: "dd-disk",
      regex: /\bdd\b.*\bof=\/dev\/(sd|hd|nvme)/i,
      reason: "Direct disk write detected",
    },
    {
      id: "mkfs",
      regex: /\bmkfs\b/i,
      reason: "Filesystem format command detected",
    },
    {
      id: "chmod-777-root",
      regex: /\bchmod\s+(-R\s+)?777\s+\//i,
      reason: "Recursive chmod 777 on root",
    },
  ];

  for (const pattern of criticalPatterns) {
    if (pattern.regex.test(command)) {
      return { blocked: true, reason: `[CRITICAL] ${pattern.reason}` };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HIGH LEVEL - Blocked at 'high' and 'strict' levels
  // ═══════════════════════════════════════════════════════════════════
  if (SAFETY_LEVEL === "high" || SAFETY_LEVEL === "strict") {
    const highPatterns = [
      // Git destructive
      {
        id: "git-force-push-main",
        regex: /\bgit\s+push\s+(-f|--force).*\b(main|master)\b/i,
        reason: "Force push to main/master branch",
      },
      {
        id: "git-reset-hard",
        regex: /\bgit\s+reset\s+--hard/i,
        reason: "git reset --hard loses uncommitted changes",
      },
      {
        id: "git-clean-force",
        regex: /\bgit\s+clean\s+-[fd]/i,
        reason: "git clean removes untracked files",
      },
      {
        id: "git-checkout-dot",
        regex: /\bgit\s+checkout\s+\./i,
        reason: "git checkout . discards all changes",
      },

      // Credential exposure
      {
        id: "echo-secret",
        regex:
          /\becho\b.*\b(AWS_SECRET|PASSWORD|API_KEY|PRIVATE_KEY|SECRET_KEY)/i,
        reason: "Echoing sensitive credentials",
      },
      {
        id: "cat-env",
        regex: /\bcat\b.*\.env(?!\.example|\.sample|\.template)/i,
        reason: "Reading .env file (use .env.example)",
      },
      {
        id: "cat-credentials",
        regex: /\bcat\b.*(credentials|id_rsa|\.pem|\.key)/i,
        reason: "Reading credential files",
      },

      // Exfiltration prevention
      {
        id: "curl-upload-env",
        regex:
          /\bcurl\b[^;|&]*(-d\s*@|-F\s*[^=]+=@)[^;|&]*(\.env|credentials|secrets|id_rsa)/i,
        reason: "Uploading sensitive files via curl",
      },
      {
        id: "scp-secrets",
        regex: /\bscp\b[^;|&]*(\.env|credentials|secrets|id_rsa)[^;|&]+:/i,
        reason: "Copying sensitive files via scp",
      },
      {
        id: "rsync-secrets",
        regex: /\brsync\b[^;|&]*(\.env|credentials|secrets)[^;|&]+:/i,
        reason: "Syncing sensitive files via rsync",
      },
      {
        id: "nc-secrets",
        regex: /\bnc\b[^;|&]*<[^;|&]*(\.env|credentials|secrets)/i,
        reason: "Sending sensitive files via netcat",
      },
      {
        id: "wget-post",
        regex: /\bwget\b.*--post-file[^;|&]*(\.env|credentials)/i,
        reason: "Posting sensitive files via wget",
      },

      // Database destructive
      {
        id: "drop-table",
        regex: /\bDROP\s+TABLE\b/i,
        reason: "DROP TABLE is destructive",
      },
      {
        id: "drop-database",
        regex: /\bDROP\s+DATABASE\b/i,
        reason: "DROP DATABASE is destructive",
      },
      {
        id: "truncate",
        regex: /\bTRUNCATE\b/i,
        reason: "TRUNCATE is destructive",
      },

      // System destructive
      {
        id: "sudo-rm",
        regex: /\bsudo\s+rm\b/i,
        reason: "sudo rm is high risk",
      },
      {
        id: "chown-recursive",
        regex: /\bchown\s+-R\b/i,
        reason: "Recursive chown changes ownership",
      },
    ];

    for (const pattern of highPatterns) {
      if (pattern.regex.test(command)) {
        return { blocked: true, reason: `[HIGH] ${pattern.reason}` };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STRICT LEVEL - Blocked only at 'strict' level
  // ═══════════════════════════════════════════════════════════════════
  if (SAFETY_LEVEL === "strict") {
    const strictPatterns = [
      {
        id: "any-force-push",
        regex: /\bgit\s+push\s+(-f|--force)/i,
        reason: "Any force push",
      },
      {
        id: "docker-prune",
        regex: /\bdocker\s+(system\s+)?prune/i,
        reason: "Docker prune removes data",
      },
      {
        id: "npm-cache-clean",
        regex: /\bnpm\s+cache\s+clean/i,
        reason: "npm cache clean",
      },
    ];

    for (const pattern of strictPatterns) {
      if (pattern.regex.test(command)) {
        return { blocked: true, reason: `[STRICT] ${pattern.reason}` };
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESCALATE - Require human approval (all levels)
  // ═══════════════════════════════════════════════════════════════════
  const escalatePatterns = [
    {
      id: "git-push-main",
      regex: /\bgit\s+push\b.*\b(main|master|origin\s+main|origin\s+master)\b/i,
      reason: "Pushing to main/master branch",
    },
    {
      id: "npm-publish",
      regex: /\bnpm\s+publish\b/i,
      reason: "Publishing to npm",
    },
    { id: "cdk-deploy", regex: /\bcdk\s+deploy\b/i, reason: "CDK deployment" },
    {
      id: "aws-delete",
      regex: /\baws\b.*\bdelete\b/i,
      reason: "AWS delete operation",
    },
    {
      id: "rm-rf",
      regex: /\brm\s+(-[rfR]+\s+)/i,
      reason: "Recursive/forced delete",
    },
    {
      id: "terraform-destroy",
      regex: /\bterraform\s+destroy\b/i,
      reason: "Terraform destroy",
    },
  ];

  for (const pattern of escalatePatterns) {
    if (pattern.regex.test(command)) {
      return {
        escalate: true,
        reason: `⚠️ High-risk: ${pattern.reason}. Requires approval.`,
      };
    }
  }

  // Allow command
  return { blocked: false, escalate: false };
}
