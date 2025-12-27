# Claude Skill Installer

A Node.js script to easily download and install Claude Code skills to both `~/.claude/skills` and `~/.codex/skills` directories.

## Features

- Downloads skills from direct URLs or GitHub repositories
- Supports single file (SKILL.md) or entire skill directories
- Automatically extracts skill name from frontmatter
- Installs to both Claude and Codex skill directories
- Handles GitHub directory downloads using sparse checkout

## Installation

### Option 1: Global Installation (Recommended)

```bash
npm link
```

After linking, you can use the `install-skill` command from anywhere:

```bash
install-skill <url> [skill-name]
```

### Option 2: Direct Usage

```bash
node install-skill.js <url> [skill-name]
```

## Usage

### Basic Examples

**Install from a direct SKILL.md URL:**
```bash
install-skill https://raw.githubusercontent.com/user/repo/main/my-skill/SKILL.md
```

**Install from a GitHub directory:**
```bash
install-skill https://github.com/user/repo/tree/main/skills/my-skill
```

**Install with a custom skill name:**
```bash
install-skill https://example.com/skill.md custom-skill-name
```

### Supported URL Formats

1. **Direct file URLs:**
   - `https://raw.githubusercontent.com/user/repo/main/skill.md`
   - `https://example.com/path/to/SKILL.md`

2. **GitHub directory URLs:**
   - `https://github.com/user/repo/tree/main/skills/my-skill`
   - `https://github.com/user/repo/tree/develop/path/to/skill`

## What It Does

1. Downloads the skill file(s) from the provided URL
2. Extracts the skill name from the SKILL.md frontmatter (or uses the provided name)
3. Creates the skill directory in both locations:
   - `~/.claude/skills/<skill-name>/`
   - `~/.codex/skills/<skill-name>/`
4. Copies all skill files to both directories

## Skill File Format

Skills should have a `SKILL.md` file with frontmatter:

```markdown
---
name: my-skill-name
description: Brief description of what this skill does
---

# Skill Content

Your skill instructions here...
```

## Requirements

- Node.js (built-in modules only, no external dependencies required)
- Optional: GitHub Personal Access Token (for higher API rate limits)

## Help

```bash
install-skill --help
```

## Examples

### Example 1: Installing a Simple Skill

```bash
install-skill https://raw.githubusercontent.com/username/skills/main/brainstorming/SKILL.md
```

Output:
```
Downloading skill file from: https://raw.githubusercontent.com/username/skills/main/brainstorming/SKILL.md
✓ Created directory: /Users/you/.claude/skills/brainstorming
✓ Created directory: /Users/you/.codex/skills/brainstorming
✓ Installed skill "brainstorming" to:
  - /Users/you/.claude/skills/brainstorming
  - /Users/you/.codex/skills/brainstorming
```

### Example 2: Installing a Skill Directory from GitHub

```bash
install-skill https://github.com/username/repo/tree/main/skills/backend-dev-guidelines
```

Output:
```
Cloning from GitHub: username/repo/skills/backend-dev-guidelines
Installing skill directory...
✓ Installed skill "backend-dev-guidelines" to:
  - /Users/you/.claude/skills/backend-dev-guidelines
  - /Users/you/.codex/skills/backend-dev-guidelines
```

## GitHub API Rate Limits

The script uses the GitHub API to download directory contents. GitHub has rate limits:
- **Unauthenticated**: 60 requests per hour
- **Authenticated**: 5,000 requests per hour

To avoid rate limits when installing skills from GitHub:

```bash
export GITHUB_TOKEN=your_github_personal_access_token
install-skill https://github.com/user/repo/tree/main/skills/my-skill
```

Create a GitHub token at: https://github.com/settings/tokens (no special permissions needed for public repos)

## Troubleshooting

**GitHub API rate limit exceeded:**
- Set the `GITHUB_TOKEN` environment variable (see above)
- Wait for the rate limit to reset (check headers or wait an hour)
- For single files, use the raw URL instead of directory URL to bypass API

**Permission errors:**
- Ensure you have write permissions to `~/.claude/skills` and `~/.codex/skills`
- The script will create these directories if they don't exist

**SKILL.md not found:**
- Ensure the URL points to a valid SKILL.md file or a directory containing one
- File name is case-insensitive (SKILL.md or skill.md both work)
