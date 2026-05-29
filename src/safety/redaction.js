const SAFETY_PATTERNS = [
  ["openai_key", /sk-[A-Za-z0-9_-]{20,}/],
  ["anthropic_key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["github_token", /gh[pousr]_[A-Za-z0-9_]{20,}/],
  ["aws_access_key", /AKIA[0-9A-Z]{16}/],
  ["private_key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["jwt", /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["stripe_key", /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["npm_token", /npm_[A-Za-z0-9]{20,}/],
  ["slack_token", /xox[baprs]-[A-Za-z0-9-]{20,}/],
  ["generic_secret_assignment", /(?:^|[^A-Za-z0-9_])(?:[A-Za-z0-9_]+[_-])?(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"]?[^'"\s]{12,}/i],
  ["env_var_reference", /\b[A-Z][A-Z0-9_]{2,}(?:KEY|TOKEN|SECRET|PASSWORD|PRIVATE|DATABASE_URL)\b/],
  ["local_file_path", /(?:^|\s)(?:\.{1,2}\/|\/Users\/|\/home\/|[A-Za-z]:\\)[^\s]+/],
  ["internal_url", /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|[^\s/]+\.(?:local|internal|test))[^\s]*/i],
];

const REDACTION_REPLACEMENTS = [
  [/sk-[A-Za-z0-9_-]{20,}/g, "[redacted-openai-key]"],
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, "[redacted-anthropic-key]"],
  [/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[redacted-github-token]"],
  [/AKIA[0-9A-Z]{16}/g, "[redacted-aws-key]"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[redacted-jwt]"],
  [/(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, "[redacted-stripe-key]"],
];

export function detectSecrets(text) {
  return scanTextForSafety(text)
    .filter((flag) => !["local_file_path", "internal_url", "env_var_reference"].includes(flag.name))
    .map((flag) => flag.name);
}

export function scanTextForSafety(text, { field = "text", includePrivacyPatterns = true } = {}) {
  const source = String(text ?? "");
  const patterns = includePrivacyPatterns
    ? SAFETY_PATTERNS
    : SAFETY_PATTERNS.filter(([name]) => !["local_file_path", "internal_url", "env_var_reference"].includes(name));

  return patterns
    .filter(([, pattern]) => pattern.test(source))
    .map(([name]) => `${field}:${name}`)
    .map((label) => ({ name: label.split(":").at(-1), field, label }));
}

export function collectEventSafetyFlags(event) {
  const flags = [
    ...scanTextForSafety(event.raw_summary, { field: "raw_summary", includePrivacyPatterns: false }),
    ...scanTextForSafety(event.public_summary, { field: "public_summary", includePrivacyPatterns: true }),
    ...scanTextForSafety(event.title, { field: "title", includePrivacyPatterns: true }),
  ];
  return Array.from(new Set(flags.map((flag) => flag.label)));
}

export function redactSecrets(text) {
  return REDACTION_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    String(text ?? ""),
  );
}
