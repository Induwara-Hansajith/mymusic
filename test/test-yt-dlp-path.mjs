import { strictEqual, ok } from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ytm = require('../src/lib/ytm.js');
const downloader = require('../src/lib/downloader.js');
const importer = require('../src/lib/importer.js');

console.log('Testing getYtDlpPath resolution across platforms...');

// 1. Windows resolution
{
  const resolved = ytm.getYtDlpPath();
  ok(resolved.endsWith('yt-dlp.exe') || resolved === 'yt-dlp.exe', `Windows path should end with yt-dlp.exe: ${resolved}`);
  ok(fs.existsSync(resolved), `Resolved Windows yt-dlp should exist: ${resolved}`);
  console.log('PASS [yt-dlp path - windows host]');
}

// 2. Linux resolution simulation
{
  const origPlatform = process.platform;
  try {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const linuxPath = ytm.getYtDlpPath();
    ok(!linuxPath.endsWith('.exe'), `Linux path must NOT end with .exe: ${linuxPath}`);
    ok(linuxPath.endsWith('yt-dlp'), `Linux path should end with yt-dlp: ${linuxPath}`);
    ok(fs.existsSync(linuxPath), `Linux yt-dlp binary must exist at dev path: ${linuxPath}`);
    console.log('PASS [yt-dlp path - linux simulation]');
  } finally {
    Object.defineProperty(process, 'platform', { value: origPlatform });
  }
}

// 3. Packaged Linux resolution simulation
{
  const origPlatform = process.platform;
  const origResourcesPath = process.resourcesPath;
  try {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.resourcesPath = path.resolve('dist/linux-unpacked/resources');
    // Mock electron.app.isPackaged = true
    const Module = require('module');
    const origRequire = Module.prototype.require;
    Module.prototype.require = function(modPath) {
      if (modPath === 'electron') {
        return { app: { isPackaged: true } };
      }
      return origRequire.apply(this, arguments);
    };

    const packagedPath = ytm.getYtDlpPath();
    Module.prototype.require = origRequire;

    ok(packagedPath.includes(path.join('dist', 'linux-unpacked', 'resources', 'bin', 'yt-dlp')), `Packaged Linux path should point to resources/bin/yt-dlp: ${packagedPath}`);
    ok(!packagedPath.endsWith('.exe'), `Packaged Linux path must NOT end with .exe: ${packagedPath}`);
    console.log('PASS [yt-dlp path - packaged linux simulation]');
  } finally {
    Object.defineProperty(process, 'platform', { value: origPlatform });
    process.resourcesPath = origResourcesPath;
  }
}

console.log('ALL YT-DLP PATH TESTS PASS');
