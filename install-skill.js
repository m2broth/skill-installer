#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');


const CLAUDE_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');
const CODEX_SKILLS_DIR = path.join(os.homedir(), '.codex', 'skills');


function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
}

function downloadFile(url, isGitHubApi = false) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Claude-Skill-Installer',
      }
    };

    if (isGitHubApi && process.env.GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    protocol.get(options, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, isGitHubApi).then(resolve).catch(reject);
      }

      if (response.statusCode === 403 && isGitHubApi) {
        reject(new Error('GitHub API rate limit exceeded. Set GITHUB_TOKEN environment variable or try again later.'));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}


function extractSkillName(content, fallbackName) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const nameMatch = frontmatterMatch[1].match(/name:\s*(.+)/);
    if (nameMatch) {
      return nameMatch[1].trim();
    }
  }
  return fallbackName;
}


function convertToRawGitHubUrl(url) {
  if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    return url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }
  return url;
}


function isGitHubDirectory(url) {
  return url.includes('github.com') && url.includes('/tree/');
}


async function downloadGitHubDirectory(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid GitHub directory URL');
  }

  const [, owner, repo, branch, dirPath] = match;
  const tempDir = path.join(os.tmpdir(), `skill-install-${Date.now()}`);

  console.log(`Downloading from GitHub: ${owner}/${repo}/${dirPath}`);

  try {
    ensureDir(tempDir);

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${branch}`;
    const response = await downloadFile(apiUrl, true);
    const files = JSON.parse(response);

    if (!Array.isArray(files)) {
      throw new Error('Invalid response from GitHub API');
    }

    const downloadPromises = files.map(async (file) => {
      if (file.type === 'file') {
        const content = await downloadFile(file.download_url);
        const filePath = path.join(tempDir, file.name);
        fs.writeFileSync(filePath, content);
        console.log(`  ✓ Downloaded: ${file.name}`);
      } else if (file.type === 'dir') {
        const subDirPath = path.join(tempDir, file.name);
        ensureDir(subDirPath);
        await downloadGitHubDirectoryRecursive(file.url, subDirPath);
      }
    });

    await Promise.all(downloadPromises);

    return tempDir;
  } catch (error) {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
}

async function downloadGitHubDirectoryRecursive(apiUrl, targetDir) {
  const response = await downloadFile(apiUrl, true);
  const files = JSON.parse(response);

  if (!Array.isArray(files)) {
    return;
  }

  const downloadPromises = files.map(async (file) => {
    if (file.type === 'file') {
      const content = await downloadFile(file.download_url);
      const filePath = path.join(targetDir, file.name);
      fs.writeFileSync(filePath, content);
      console.log(`  ✓ Downloaded: ${path.basename(targetDir)}/${file.name}`);
    } else if (file.type === 'dir') {
      const subDirPath = path.join(targetDir, file.name);
      ensureDir(subDirPath);
      await downloadGitHubDirectoryRecursive(file.url, subDirPath);
    }
  });

  await Promise.all(downloadPromises);
}


function copyDirectory(src, dest) {
  ensureDir(dest);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}


async function installFromSingleFile(url, skillName) {
  console.log(`Downloading skill file from: ${url}`);

  const rawUrl = convertToRawGitHubUrl(url);
  const content = await downloadFile(rawUrl);

  const extractedName = extractSkillName(content, skillName || 'downloaded-skill');
  const finalSkillName = skillName || extractedName;

  const claudeSkillDir = path.join(CLAUDE_SKILLS_DIR, finalSkillName);
  const codexSkillDir = path.join(CODEX_SKILLS_DIR, finalSkillName);

  ensureDir(claudeSkillDir);
  ensureDir(codexSkillDir);

  const skillFile = 'SKILL.md';
  fs.writeFileSync(path.join(claudeSkillDir, skillFile), content);
  fs.writeFileSync(path.join(codexSkillDir, skillFile), content);

  console.log(`✓ Installed skill "${finalSkillName}" to:`);
  console.log(`  - ${claudeSkillDir}`);
  console.log(`  - ${codexSkillDir}`);
}

async function installFromDirectory(sourceDir, skillName) {
  const files = fs.readdirSync(sourceDir);
  const skillFile = files.find(f => f.toLowerCase() === 'skill.md');

  if (!skillFile) {
    throw new Error('No SKILL.md file found in the directory');
  }

  const skillContent = fs.readFileSync(path.join(sourceDir, skillFile), 'utf8');
  const extractedName = extractSkillName(skillContent, skillName || path.basename(sourceDir));
  const finalSkillName = skillName || extractedName;

  const claudeSkillDir = path.join(CLAUDE_SKILLS_DIR, finalSkillName);
  const codexSkillDir = path.join(CODEX_SKILLS_DIR, finalSkillName);

  console.log(`Installing skill directory...`);
  copyDirectory(sourceDir, claudeSkillDir);
  copyDirectory(sourceDir, codexSkillDir);

  console.log(`✓ Installed skill "${finalSkillName}" to:`);
  console.log(`  - ${claudeSkillDir}`);
  console.log(`  - ${codexSkillDir}`);
}


async function installSkill(url, skillName) {
  try {
    ensureDir(CLAUDE_SKILLS_DIR);
    ensureDir(CODEX_SKILLS_DIR);

    if (isGitHubDirectory(url)) {
      const tempDir = await downloadGitHubDirectory(url);
      try {
        await installFromDirectory(tempDir, skillName);
      } finally {
        if (tempDir.includes('skill-install-')) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    } else {
      await installFromSingleFile(url, skillName);
    }
  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Skill Installer for Claude Code

Usage:
  node install-skill.js <url> [skill-name]

Arguments:
  url         URL to the skill file or directory
              - Direct link to SKILL.md file
              - GitHub directory URL (e.g., https://github.com/user/repo/tree/main/skills/my-skill)
  skill-name  Optional: Custom name for the skill folder (defaults to name from frontmatter)

Examples:
  node install-skill.js https://raw.githubusercontent.com/user/repo/main/my-skill/SKILL.md
  node install-skill.js https://github.com/user/repo/tree/main/skills/my-skill
  node install-skill.js https://example.com/skill.md custom-skill-name

Installs to:
  - ~/.claude/skills/<skill-name>/
  - ~/.codex/skills/<skill-name>/
`);
  process.exit(0);
}

const [url, skillName] = args;
installSkill(url, skillName);
